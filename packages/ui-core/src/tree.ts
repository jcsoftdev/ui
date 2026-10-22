export interface TreeNode {
  id: string;
  name: string;
  /** Present (even empty) for branches. */
  children?: TreeNode[];
}

export interface TreeRow<T extends TreeNode = TreeNode> {
  node: T;
  /** 1-based, for `aria-level`. */
  depth: number;
  parentId: string | null;
  /** 1-based position among siblings, for `aria-posinset`. */
  position: number;
  /** Number of siblings, for `aria-setsize`. */
  setSize: number;
  isBranch: boolean;
  expanded: boolean;
}

/** The rows currently visible, in display order, given the set of expanded branch ids. */
export function flattenTree<T extends TreeNode>(
  nodes: readonly T[],
  expanded: ReadonlySet<string>,
): TreeRow<T>[] {
  const rows: TreeRow<T>[] = [];
  const walk = (list: readonly T[], depth: number, parentId: string | null) => {
    list.forEach((node, index) => {
      const isBranch = node.children !== undefined;
      const open = isBranch && expanded.has(node.id);
      rows.push({
        node,
        depth,
        parentId,
        position: index + 1,
        setSize: list.length,
        isBranch,
        expanded: open,
      });
      if (open && node.children) walk(node.children as T[], depth + 1, node.id);
    });
  };
  walk(nodes, 1, null);
  return rows;
}

export type TreeKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

export type TreeStep =
  | { type: "focus"; id: string }
  | { type: "expand"; id: string }
  | { type: "collapse"; id: string }
  | null;

export const TREE_KEYS: readonly string[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
];

/** WAI-ARIA tree navigation: what a key does on the row `currentId`. */
export function treeStep(rows: readonly TreeRow[], currentId: string, key: TreeKey): TreeStep {
  const at = rows.findIndex((row) => row.node.id === currentId);
  const row = rows[at];
  if (!row) return null;
  switch (key) {
    case "ArrowDown": {
      const next = rows[at + 1];
      return next ? { type: "focus", id: next.node.id } : null;
    }
    case "ArrowUp": {
      const prev = rows[at - 1];
      return prev ? { type: "focus", id: prev.node.id } : null;
    }
    case "Home":
      return rows[0] ? { type: "focus", id: rows[0].node.id } : null;
    case "End": {
      const last = rows[rows.length - 1];
      return last ? { type: "focus", id: last.node.id } : null;
    }
    case "ArrowRight": {
      if (!row.isBranch) return null;
      if (!row.expanded) return { type: "expand", id: row.node.id };
      const child = rows[at + 1];
      return child && child.parentId === row.node.id ? { type: "focus", id: child.node.id } : null;
    }
    case "ArrowLeft": {
      if (row.isBranch && row.expanded) return { type: "collapse", id: row.node.id };
      return row.parentId ? { type: "focus", id: row.parentId } : null;
    }
  }
}

/** Lower case without diacritics, so "e" finds "Éxito". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Next row whose name starts with `query`, searching after `currentId` and wrapping. */
export function treeTypeahead(
  rows: readonly TreeRow[],
  currentId: string,
  query: string,
): string | null {
  if (!query) return null;
  const needle = fold(query);
  const start = rows.findIndex((row) => row.node.id === currentId);
  for (let step = 1; step <= rows.length; step += 1) {
    const row = rows[(start + step) % rows.length];
    if (row && fold(row.node.name).startsWith(needle)) return row.node.id;
  }
  return null;
}

/** Ids of every branch (to expand all). */
export function branchIds(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => (node.children ? [node.id, ...branchIds(node.children)] : []));
}

/** Ancestors of `id`, root first; empty when unknown. */
export function ancestorsOf(nodes: readonly TreeNode[], id: string): string[] {
  const walk = (list: readonly TreeNode[], path: string[]): string[] | null => {
    for (const node of list) {
      if (node.id === id) return path;
      const found = node.children ? walk(node.children, [...path, node.id]) : null;
      if (found) return found;
    }
    return null;
  };
  return walk(nodes, []) ?? [];
}

export interface TreeOptions<T extends TreeNode = TreeNode> {
  nodes: () => readonly T[];
  /** Currently expanded branch ids. */
  expanded: () => ReadonlySet<string>;
  /** Called with the next expanded ids when a branch opens or closes. */
  onExpandedChange: (ids: string[]) => void;
  /** Called when Enter, Space or a click selects a row. */
  onSelect?: (id: string, node: T) => void;
  /** Selected id, used for the initial tab stop. */
  selected?: () => string | null | undefined;
  /** Finds the focusable element of a row. Default: `[data-node-id]` under the root. */
  rowElement?: (id: string) => HTMLElement | null;
  /** Typeahead reset delay in ms. Default 600. */
  typeaheadTimeout?: number;
  /** Right-to-left: ArrowLeft opens and ArrowRight closes. Default `() => false`. */
  rtl?: () => boolean;
}

export interface Tree {
  /** Rows currently visible. */
  rows(): TreeRow[];
  /** Id that holds the tab stop: last focused, else selected, else first. */
  tabStop(): string | undefined;
  /** Re-applies `tabindex` and `aria-*` after the data or the expansion changed. */
  update(): void;
  focus(id: string): void;
  destroy(): void;
}

const escapeId = (id: string) =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");

/**
 * Keyboard model of the WAI-ARIA tree pattern on rows marked `[data-node-id]`: one tab stop,
 * arrows move and open/close, Home/End, typeahead, Enter/Space select (and toggle a branch).
 * The caller renders the rows; this attaches the keys, the roving tab stop and the ARIA
 * attributes (`role`, `aria-level/posinset/setsize/expanded/selected`).
 */
export function createTree(root: HTMLElement, options: TreeOptions): Tree {
  const timeout = options.typeaheadTimeout ?? 600;
  let focusId: string | null = null;
  let typed = { text: "", at: 0 };

  const rows = () => flattenTree(options.nodes(), options.expanded());
  const tabStop = () => {
    const list = rows();
    return (
      list.find((row) => row.node.id === focusId)?.node.id ??
      list.find((row) => row.node.id === options.selected?.())?.node.id ??
      list[0]?.node.id
    );
  };
  const element = (id: string) =>
    options.rowElement?.(id) ?? root.querySelector<HTMLElement>(`[data-node-id="${escapeId(id)}"]`);
  const rowOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.<HTMLElement>("[data-node-id]");
    return el && root.contains(el) ? el : null;
  };

  const update = () => {
    const stop = tabStop();
    const selected = options.selected?.();
    for (const row of rows()) {
      const el = element(row.node.id);
      if (!el) continue;
      el.setAttribute("role", "treeitem");
      el.tabIndex = row.node.id === stop ? 0 : -1;
      el.setAttribute("aria-level", String(row.depth));
      el.setAttribute("aria-posinset", String(row.position));
      el.setAttribute("aria-setsize", String(row.setSize));
      el.setAttribute("aria-selected", String(row.node.id === selected));
      if (row.isBranch) el.setAttribute("aria-expanded", String(row.expanded));
      else el.removeAttribute("aria-expanded");
    }
  };

  const focus = (id: string) => {
    focusId = id;
    update();
    element(id)?.focus();
  };

  const toggle = (id: string, open: boolean) => {
    const next = [...options.expanded()].filter((x) => x !== id);
    if (open) next.push(id);
    options.onExpandedChange(next);
  };

  const select = (row: TreeRow) => {
    options.onSelect?.(row.node.id, row.node);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const el = rowOf(event.target);
    if (!el || event.target !== el) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const id = el.dataset.nodeId as string;
    const list = rows();
    const row = list.find((r) => r.node.id === id);
    if (!row) return;
    if (TREE_KEYS.includes(event.key)) {
      event.preventDefault();
      const flip = options.rtl?.() === true;
      const key =
        flip && event.key === "ArrowLeft"
          ? "ArrowRight"
          : flip && event.key === "ArrowRight"
            ? "ArrowLeft"
            : event.key;
      const step = treeStep(list, id, key as TreeKey);
      if (!step) return;
      if (step.type === "focus") focus(step.id);
      else toggle(step.id, step.type === "expand");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(row);
      if (row.isBranch) toggle(id, !row.expanded);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const now = Date.now();
      typed = { text: now - typed.at > timeout ? event.key : typed.text + event.key, at: now };
      const match = treeTypeahead(list, id, typed.text);
      if (match) focus(match);
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    const el = rowOf(event.target);
    if (el && event.target === el && el.dataset.nodeId !== focusId) {
      focusId = el.dataset.nodeId as string;
      update();
    }
  };

  const onClick = (event: MouseEvent) => {
    const el = rowOf(event.target);
    if (!el) return;
    const id = el.dataset.nodeId as string;
    const row = rows().find((r) => r.node.id === id);
    if (!row) return;
    select(row);
    if (row.isBranch) toggle(id, !row.expanded);
    focusId = id;
    update();
  };

  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("click", onClick);
  update();
  return {
    rows,
    tabStop,
    update,
    focus,
    destroy() {
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("click", onClick);
    },
  };
}
