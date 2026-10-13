// Scaffolds a new element: pnpm --filter @jcsoftdev/ui-elements new <name> [--light] [--form] [--material]
//   <name>      kebab-case entry and tag suffix (`date-picker` -> <ui-date-picker>, defineDatePicker)
//   --light     light-DOM composite (parts are children; styles adopted into the root node)
//               default: shadow-DOM leaf (the host is the control, ARIA through ElementInternals)
//   --form      form-associated, on the shared FormElement base (value, validity, reset, disabled)
//   --material  supports material="liquid" (lazy; nothing liquid loads until it is asked for)
// It writes src/<name>/{<name>.ts,<name>.css,size.json} and test/<name>.browser.test.ts. The entry,
// export, index, size check and tree-shake check pick the folder up on their own.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineName, root } from "./entries.mjs";

const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith("--"));
if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error("usage: new-element <kebab-name> [--light] [--form] [--material]");
  process.exit(1);
}
const light = args.includes("--light");
const form = args.includes("--form");
const material = args.includes("--material");
const dir = join(root, "src", name);
if (existsSync(dir)) {
  console.error(`src/${name} already exists`);
  process.exit(1);
}
const define = defineName(name);
const klass = `Ui${define.slice("define".length)}`;
const tag = `ui-${name}`;

const imports = [
  `import {\n  adoptStyles,\n  type DefineOptions,\n  defineElement,${form ? "" : "\n  ElementBase,"}${light ? "\n  rootOf," : ""}\n} from "../internal/base.js";`,
  form ? 'import { FormElement } from "../internal/form.js";' : "",
  material ? 'import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";' : "",
  `import css from "./${name}.css.js";`,
].filter(Boolean);

const observed = form
  ? `static override observedAttributes = [...FormElement.observedAttributes${material ? ", ...MATERIAL_ATTRIBUTES" : ""}];`
  : `static observedAttributes: string[] = [${material ? "...MATERIAL_ATTRIBUTES" : ""}];`;

const ts = `${imports.join("\n")}

/**
 * \`<${tag}>\`: TODO one sentence on what it is and which WAI-ARIA pattern it follows.
 * Attributes: TODO. Events: TODO.
 */
export class ${klass} extends ${form ? "FormElement" : "ElementBase"} {
  ${observed}
${form ? "" : "  readonly #internals = this.attachInternals();\n"}${material ? `  readonly #material = new Material(this, () => this${light ? "" : ", () => this.shadowRoot ?? undefined"});\n` : ""}
  constructor() {
    super();
${
  light
    ? ""
    : `    const root = this.attachShadow({ mode: "open"${form ? "" : ""} });
    adoptStyles(root, css);
    root.innerHTML = "<slot></slot>";
`
}    ${form ? "this.internals" : "this.#internals"}.role = "group"; // TODO the control's role
  }

${
  form
    ? `  override connectedCallback(): void {
${light ? `    this.dataset.ui = "${name}";\n    adoptStyles(rootOf(this), css);\n` : ""}    super.connectedCallback();${material ? "\n    this.#material.sync();" : ""}
  }
${
  material
    ? `
  disconnectedCallback(): void {
    this.#material.stop();
  }

  override attributeChangedCallback(name: string): void {
    if ((MATERIAL_ATTRIBUTES as readonly string[]).includes(name)) this.#material.sync();
    else super.attributeChangedCallback(name);
  }
`
    : ""
}
  protected render(): void {
    // TODO reflect this.value / this.disabled into the DOM and ARIA state.
  }`
    : `  connectedCallback(): void {
${light ? `    this.dataset.ui = "${name}";\n    adoptStyles(rootOf(this), css);\n` : ""}    this.#render();${material ? "\n    this.#material.sync();" : ""}
  }
${
  material
    ? `
  disconnectedCallback(): void {
    this.#material.stop();
  }
`
    : ""
}
  attributeChangedCallback(${material ? "name: string" : ""}): void {
    ${material ? "if ((MATERIAL_ATTRIBUTES as readonly string[]).includes(name)) this.#material.sync();\n    else " : ""}this.#render();
  }

  #render(): void {
    // TODO reflect attributes into the DOM and ARIA state.
  }`
}
}

/** Registers \`<${tag}>\` (or \`<prefix-${name}>\`) and returns the tag. */
export function ${define}(options?: DefineOptions): string {
  return defineElement("${name}", ${klass}, options);
}
`;

const selector = light ? `[data-ui="${name}"]` : ":host";
const cssText = `${selector} {
  /* Component variables are --ui-${name}-*; everything else must be a ui-tokens token. */
  display: ${light ? "block" : "inline-flex"};
  font-family: var(--font-sans);
  color: var(--ink);
}
${light ? `${selector}[hidden]` : ":host([hidden])"} {
  display: none;
}
`;

const test = `import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ${define} } from "../src/${name}/${name}.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  ${define}();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("${tag}", () => {
  it("exposes its role and name to assistive technology", async () => {
    mount(\`<${tag} aria-label="Example"></${tag}>\`);
    expect(await ax("group", "Example")).toBeTruthy(); // TODO the real role
  });

  it("registers under a custom prefix", () => {
    expect(${define}({ prefix: "acme" })).toBe("acme-${name}");
  });
});
`;

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${name}.ts`), ts);
writeFileSync(join(dir, `${name}.css`), cssText);
writeFileSync(join(dir, "size.json"), '{ "maxGzip": null }\n');
writeFileSync(join(root, "test", `${name}.browser.test.ts`), test);
console.log(`new-element: <${tag}> (${light ? "light" : "shadow"}${form ? ", form" : ""}${material ? ", material" : ""})
  src/${name}/${name}.ts, src/${name}/${name}.css, src/${name}/size.json, test/${name}.browser.test.ts
next: implement, test, \`pnpm build\`, then \`node ../../scripts/check-size.mjs\` prints the budget to put in size.json.`);
