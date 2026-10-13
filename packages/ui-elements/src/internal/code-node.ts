/** The tag of a sibling element under the same prefix: `ui-tool-call` -> `ui-code-block`. */
export function siblingTag(host: Element, own: string, other: string): string {
  const tag = host.localName;
  return `${tag.endsWith(own) ? tag.slice(0, -own.length) : "ui-"}${other}`;
}

/**
 * A block of code for `host` to place in its own content. When `<prefix-code-block>` is defined
 * the page opted in to it (copy button, line numbers, lazy highlighting), so it is used;
 * otherwise a plain scrollable `<pre><code>`. Code is always set as text or as an attribute, never
 * as markup. This module never imports the code-block entry, so each element stays tree-shakeable.
 */
export function codeNode(
  host: Element,
  own: string,
  code: string,
  language?: string | null,
  highlight = false,
): HTMLElement {
  const tag = siblingTag(host, own, "code-block");
  if (typeof customElements !== "undefined" && customElements.get(tag)) {
    const block = document.createElement(tag);
    block.setAttribute("code", code);
    if (language) block.setAttribute("language", language);
    if (highlight) block.setAttribute("highlight", "");
    return block;
  }
  const pre = document.createElement("pre");
  pre.dataset.uiPart = "code";
  pre.tabIndex = 0;
  const element = document.createElement("code");
  if (language) element.dataset.language = language;
  element.textContent = code;
  pre.append(element);
  return pre;
}
