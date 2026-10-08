// Walks a package's `src/<entry>/index.ts` files with the TypeScript compiler API and describes every
// public export: React components (with props, defaults, JSDoc) and everything else (hooks, functions, constants).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const isNodeModules = (file) => file.includes("/node_modules/");

/** `src/<dir>/index.ts` entries: depth 1 are package subpaths, depth 2 are single-component entries. */
export function discoverEntries(srcDir) {
  const entries = [];
  const dirs = (d) =>
    readdirSync(d, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "node_modules")
      .map((e) => e.name)
      .sort();
  for (const top of dirs(srcDir)) {
    const topIndex = path.join(srcDir, top, "index.ts");
    if (existsSync(topIndex))
      entries.push({
        subpath: top,
        depth: 1,
        category: top,
        file: topIndex,
        dir: path.join(srcDir, top),
      });
    for (const sub of dirs(path.join(srcDir, top))) {
      const subIndex = path.join(srcDir, top, sub, "index.ts");
      if (existsSync(topIndex) && existsSync(subIndex)) {
        entries.push({
          subpath: `${top}/${sub}`,
          depth: 2,
          category: top,
          file: subIndex,
          dir: path.join(srcDir, top, sub),
        });
      }
    }
  }
  return entries;
}

const DEFAULT_OPTIONS = {
  target: ts.ScriptTarget.ES2022,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  isolatedModules: true,
  types: [],
};

const FORMAT_FLAGS =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.WriteArrowStyleSignature;

function docOf(symbol, checker) {
  return ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
}

function tagsOf(symbol) {
  const tags = {};
  for (const t of symbol.getJsDocTags()) {
    const text = ts.displayPartsToString(t.text ?? []).trim();
    (tags[t.name] ??= []).push(text);
  }
  return tags;
}

function firstFunctionLike(node, depth = 0) {
  if (!node || depth > 4) return undefined;
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))
    return node;
  if (ts.isVariableDeclaration(node)) return firstFunctionLike(node.initializer, depth + 1);
  if (ts.isCallExpression(node)) {
    for (const a of node.arguments) {
      const f = firstFunctionLike(a, depth + 1);
      if (f) return f;
    }
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return firstFunctionLike(node.expression, depth + 1);
  }
  return undefined;
}

/** Defaults declared as `{ variant = "primary" }` in the first parameter of the implementation. */
function destructuredDefaults(declaration) {
  const fn = firstFunctionLike(declaration);
  const param = fn?.parameters[0];
  const defaults = {};
  if (param && ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (!el.initializer || el.dotDotDotToken) continue;
      const key = (el.propertyName ?? el.name).getText();
      defaults[key] = el.initializer.getText();
    }
  }
  return defaults;
}

function typeText(checker, type, node, optional) {
  const t = type;
  let members = t.isUnion() ? t.types : [t];
  if (optional) members = members.filter((m) => !(m.flags & ts.TypeFlags.Undefined));
  const literalLike = (m) =>
    m.isLiteral() || m.flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.Null);
  if (members.length > 1 && members.length <= 14 && members.every(literalLike)) {
    const parts = members.map((m) => checker.typeToString(m, node, FORMAT_FLAGS));
    const hasBoth = parts.includes("true") && parts.includes("false");
    return (
      hasBoth ? ["boolean", ...parts.filter((p) => p !== "true" && p !== "false")] : parts
    ).join(" | ");
  }
  let s = checker.typeToString(t, node, FORMAT_FLAGS);
  if (optional) s = s.replace(/\s*\|\s*undefined$/, "");
  return s;
}

function isJsxLikeReturn(checker, signature) {
  const ret = checker.typeToString(signature.getReturnType());
  return (
    /\b(Element|ReactNode|ReactElement|ReactPortal)\b/.test(ret) || /^(JSX\.Element|null)/.test(ret)
  );
}

function describeProps(checker, signature, declaration, srcDir) {
  const param = signature.parameters[0];
  if (!param) return { props: [], inheritsNative: false };
  const paramDecl = param.valueDeclaration ?? declaration;
  const propsType = checker.getTypeOfSymbolAtLocation(param, paramDecl);
  const defaults = destructuredDefaults(declaration);
  const props = [];
  let inheritsNative = false;
  for (const p of checker.getPropertiesOfType(propsType)) {
    const decls = p.declarations ?? [];
    const own = decls.some((d) => !isNodeModules(d.getSourceFile().fileName));
    if (!own) {
      inheritsNative = true;
      continue;
    }
    const decl = decls[0];
    const optional = Boolean(p.flags & ts.SymbolFlags.Optional);
    const type = checker.getTypeOfSymbolAtLocation(p, decl);
    const tags = tagsOf(p);
    props.push({
      name: p.getName(),
      type: typeText(checker, type, decl, optional),
      required: !optional,
      default: tags.default?.[0] ?? tags.defaultValue?.[0] ?? defaults[p.getName()] ?? null,
      description: docOf(p, checker),
      deprecated: tags.deprecated ? tags.deprecated[0] || true : false,
      file: path.relative(srcDir, decl.getSourceFile().fileName),
    });
  }
  return { props, inheritsNative };
}

function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function paragraphsMatching(text, re) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => re.test(p));
}

/**
 * Analyze a package source tree.
 * @param {{ srcDir: string, packageName?: string, options?: object }} input
 */
export function analyzePackage({ srcDir, packageName = "@jcsoftdev/ui", options = {} }) {
  const entries = discoverEntries(srcDir);
  const program = ts.createProgram(
    entries.map((e) => e.file),
    { ...DEFAULT_OPTIONS, ...options },
  );
  const checker = program.getTypeChecker();

  const exportsOf = (entry) => {
    const sf = program.getSourceFile(entry.file);
    const mod = sf && checker.getSymbolAtLocation(sf);
    return mod ? checker.getExportsOfModule(mod) : [];
  };
  const resolve = (sym) => (sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym);

  // name -> single-component entries that export it
  const deepEntries = new Map();
  for (const e of entries.filter((x) => x.depth === 2)) {
    for (const sym of exportsOf(e)) {
      (
        deepEntries.get(sym.getName()) ?? deepEntries.set(sym.getName(), []).get(sym.getName())
      ).push(e);
    }
  }

  const components = [];
  const others = [];
  const typeNames = new Set();
  const seen = new Set();
  const topEntries = entries.filter((e) => e.depth === 1);

  for (const entry of topEntries) {
    for (const exported of exportsOf(entry)) {
      const name = exported.getName();
      const target = resolve(exported);
      const decl = target.valueDeclaration ?? target.declarations?.[0];
      if (!decl) continue;
      const declFile = decl.getSourceFile().fileName;
      if (isNodeModules(declFile)) continue;
      const isValue = Boolean(target.flags & ts.SymbolFlags.Value);
      if (!isValue) {
        typeNames.add(`${entry.subpath}:${name}`);
        continue;
      }
      const owner = topEntries.find((e) => declFile.startsWith(`${e.dir}${path.sep}`)) ?? entry;
      if (owner !== entry) continue;
      const key = `${entry.subpath}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const type = checker.getTypeOfSymbolAtLocation(target, decl);
      const signatures = type.getCallSignatures();
      const base = {
        name,
        slug: kebab(name),
        category: entry.category,
        subpath: entry.subpath,
        importPath: `${packageName}/${entry.subpath}`,
        declarationFile: path.relative(srcDir, declFile),
        summary: docOf(target, checker),
        tags: tagsOf(target),
      };
      const isComponent =
        /^[A-Z]/.test(name) &&
        signatures.length > 0 &&
        signatures[0].parameters.length <= 2 &&
        isJsxLikeReturn(checker, signatures[0]);

      if (isComponent) {
        const { props, inheritsNative } = describeProps(checker, signatures[0], decl, srcDir);
        const propsSymbol =
          signatures[0].parameters[0] &&
          checker.getTypeOfSymbolAtLocation(signatures[0].parameters[0], decl).getSymbol();
        const summary = base.summary || (propsSymbol ? docOf(propsSymbol, checker) : "");
        const description =
          [base.summary, propsSymbol ? docOf(propsSymbol, checker) : ""].filter(Boolean)[0] ?? "";
        const a11yTags = [
          ...(base.tags.a11y ?? []),
          ...(base.tags.accessibility ?? []),
          ...(base.tags.keyboard ?? []),
        ];
        const a11yNotes = [
          ...a11yTags,
          ...paragraphsMatching(description, /^(keyboard|a11y|accessib|aria)/i),
        ];
        components.push({
          ...base,
          kind: "component",
          summary,
          props,
          inheritsNativeProps: inheritsNative,
          a11y: [...new Set(a11yNotes)],
          examples: base.tags.example ?? [],
          deprecated: Boolean(base.tags.deprecated),
          singleEntries: (deepEntries.get(name) ?? [])
            .filter((e) => e.category === entry.category)
            .map((e) => `${packageName}/${e.subpath}`),
        });
      } else {
        const kind = signatures.length
          ? /^use[A-Z]/.test(name)
            ? "hook"
            : "function"
          : target.flags & ts.SymbolFlags.Class
            ? "class"
            : "constant";
        others.push({
          ...base,
          kind,
          signature: signatures.length
            ? checker.typeToString(type, decl, FORMAT_FLAGS).slice(0, 400)
            : checker.typeToString(type, decl, FORMAT_FLAGS).slice(0, 160),
        });
      }
    }
  }

  components.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  others.sort((a, b) => a.subpath.localeCompare(b.subpath) || a.name.localeCompare(b.name));
  return {
    packageName,
    entries: entries.map((e) => ({
      subpath: e.subpath,
      depth: e.depth,
      category: e.category,
      importPath: `${packageName}/${e.subpath}`,
    })),
    components,
    others,
    typeCount: typeNames.size,
  };
}
