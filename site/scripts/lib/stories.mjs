// Static analysis of Storybook CSF files: title, component, story export names, ids and source.
// No Storybook runtime is needed; ids follow Storybook's own `toId` rules.
import { readFileSync } from "node:fs";
import ts from "typescript";

const SANITIZE = /[ '–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi;

function sanitize(value, fallback) {
  const out = String(value)
    .toLowerCase()
    .replace(SANITIZE, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return out || fallback;
}

/** lodash `startCase` as Storybook applies it to export names ("Downsampled100K" -> "Downsampled 100 K"). */
export function storyNameFromExport(key) {
  const words = key.match(/[A-Z]{2,}(?=[A-Z][a-z]|\b|\d)|[A-Z]?[a-z]+|[A-Z]+|\d+/g) ?? [key];
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** The id comes from the export name; a `name:` property only changes the label. */
export function toStoryId(title, exportName) {
  return `${sanitize(title, "component")}--${sanitize(storyNameFromExport(exportName), "story")}`;
}

function unwrap(node) {
  let n = node;
  while (
    n &&
    (ts.isSatisfiesExpression(n) || ts.isAsExpression(n) || ts.isParenthesizedExpression(n))
  ) {
    n = n.expression;
  }
  return n;
}

function prop(obj, name) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return undefined;
  return obj.properties.find(
    (p) =>
      (ts.isPropertyAssignment(p) ||
        ts.isMethodDeclaration(p) ||
        ts.isShorthandPropertyAssignment(p)) &&
      p.name.getText() === name,
  );
}

function stringValue(p) {
  if (p && ts.isPropertyAssignment(p)) {
    const init = unwrap(p.initializer);
    if (ts.isStringLiteralLike(init)) return init.text;
  }
  return undefined;
}

/**
 * @typedef {{ key: string, text: string, kind: "string" | "expression" | "jsx" | "function" }} ArgEntry
 * @typedef {{ exportName: string, name: string, id: string, hasRender: boolean, args: ArgEntry[], source: string }} StoryInfo
 */

function argEntries(objectLiteral) {
  /** @type {ArgEntry[]} */
  const out = [];
  if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) return out;
  for (const p of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) continue;
    const key = ts.isStringLiteralLike(p.name) ? p.name.text : p.name.getText();
    const init = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : p.name;
    let kind = "expression";
    if (ts.isStringLiteralLike(init)) kind = "string";
    else if (ts.isJsxElement(init) || ts.isJsxSelfClosingElement(init) || ts.isJsxFragment(init))
      kind = "jsx";
    else if (ts.isArrowFunction(init) || ts.isFunctionExpression(init) || ts.isCallExpression(init))
      kind = "function";
    out.push({ key, text: ts.isStringLiteralLike(init) ? init.text : init.getText(), kind });
  }
  return out;
}

/** Parse one `*.stories.tsx` file. Returns null when it has no default-exported meta. */
export function parseStoriesFile(filePath, text = readFileSync(filePath, "utf8")) {
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  /** @type {import("typescript").ObjectLiteralExpression | undefined} */
  let meta;
  const vars = new Map();
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) vars.set(d.name.text, unwrap(d.initializer));
      }
    }
  }
  for (const st of sf.statements) {
    if (ts.isExportAssignment(st)) {
      const e = unwrap(st.expression);
      meta = ts.isIdentifier(e) ? vars.get(e.text) : e;
    }
  }
  if (!meta || !ts.isObjectLiteralExpression(meta)) return null;
  const title = stringValue(prop(meta, "title"));
  if (!title) return null;
  const compProp = prop(meta, "component");
  const component =
    compProp && ts.isPropertyAssignment(compProp) ? compProp.initializer.getText() : undefined;
  const metaArgs = argEntries(unwrap(prop(meta, "args")?.initializer));
  const metaHasRender = Boolean(prop(meta, "render"));

  /** @type {StoryInfo[]} */
  const stories = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      const exportName = d.name.text;
      const init = d.initializer ? unwrap(d.initializer) : undefined;
      const obj = init && ts.isObjectLiteralExpression(init) ? init : undefined;
      const explicit = stringValue(prop(obj, "name"));
      stories.push({
        exportName,
        name: explicit ?? storyNameFromExport(exportName),
        id: toStoryId(title, exportName),
        hasRender: Boolean(prop(obj, "render")),
        args: argEntries(unwrap(prop(obj, "args")?.initializer)),
        source: st.getText(),
      });
    }
  }
  return { filePath, title, component, metaArgs, metaHasRender, stories };
}

/** Pick the story that best represents the component: `Default`, else the first one. */
export function pickDefaultStory(info) {
  return info.stories.find((s) => s.exportName === "Default") ?? info.stories[0];
}

/**
 * Build a JSX usage snippet from the serializable args of a story (meta args merged with story args).
 * Returns null when the story renders through a custom `render` or when there is no component name.
 */
export function usageSnippet(componentName, info, story) {
  if (!componentName || !story || story.hasRender || info.metaHasRender) return null;
  const merged = new Map();
  for (const a of info.metaArgs) merged.set(a.key, a);
  for (const a of story.args) merged.set(a.key, a);
  const attrs = [];
  let children = null;
  for (const a of merged.values()) {
    if (a.kind === "function") continue;
    if (a.key === "children") {
      children = a;
      continue;
    }
    if (a.kind === "string") attrs.push(`${a.key}=${JSON.stringify(a.text)}`);
    else if (a.text === "true") attrs.push(a.key);
    else attrs.push(`${a.key}={${a.text}}`);
  }
  const oneLine = attrs.join(" ");
  const multiline = oneLine.length > 60;
  const open = multiline
    ? `<${componentName}\n${attrs.map((a) => `  ${a}`).join("\n")}\n`
    : `<${componentName}${attrs.length ? ` ${oneLine}` : ""}`;
  if (!children) return multiline ? `${open}/>` : `${open} />`;
  const inner =
    children.kind === "string" || children.kind === "jsx" ? children.text : `{${children.text}}`;
  return `${open}>\n  ${inner.replace(/\n/g, "\n  ")}\n</${componentName}>`;
}
