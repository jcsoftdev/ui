export interface FileTreeNode {
  id: string;
  name: string;
  /** Present (even empty) for folders. */
  children?: FileTreeNode[];
}

export interface FlatRow {
  node: FileTreeNode;
  depth: number;
  parentId: string | null;
  /** 1-based position among siblings, for aria-posinset. */
  position: number;
  setSize: number;
  isFolder: boolean;
  expanded: boolean;
}

/** Rows currently visible, in display order, given the set of expanded folder ids. */
export function flattenTree(nodes: FileTreeNode[], expanded: ReadonlySet<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (list: FileTreeNode[], depth: number, parentId: string | null) => {
    list.forEach((node, i) => {
      const isFolder = node.children !== undefined;
      const isOpen = isFolder && expanded.has(node.id);
      rows.push({
        node,
        depth,
        parentId,
        position: i + 1,
        setSize: list.length,
        isFolder,
        expanded: isOpen,
      });
      if (isOpen && node.children) walk(node.children, depth + 1, node.id);
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

/** WAI-ARIA tree navigation: what a key does on the row `currentId`. */
export function treeStep(rows: FlatRow[], currentId: string, key: TreeKey): TreeStep {
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
      if (!row.isFolder) return null;
      if (!row.expanded) return { type: "expand", id: row.node.id };
      const child = rows[at + 1];
      return child && child.parentId === row.node.id ? { type: "focus", id: child.node.id } : null;
    }
    case "ArrowLeft": {
      if (row.isFolder && row.expanded) return { type: "collapse", id: row.node.id };
      return row.parentId ? { type: "focus", id: row.parentId } : null;
    }
  }
}

/** Next row whose name starts with `query`, searching after `currentId` and wrapping. */
export function typeahead(rows: FlatRow[], currentId: string, query: string): string | null {
  if (!query) return null;
  const needle = query.toLowerCase();
  const start = rows.findIndex((row) => row.node.id === currentId);
  for (let step = 1; step <= rows.length; step += 1) {
    const row = rows[(start + step) % rows.length];
    if (row?.node.name.toLowerCase().startsWith(needle)) return row.node.id;
  }
  return null;
}

/** Ids of every folder (used to expand all by default). */
export function folderIds(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) => (node.children ? [node.id, ...folderIds(node.children)] : []));
}

/** Ancestors of `id`, root first; empty when unknown. */
export function ancestorsOf(nodes: FileTreeNode[], id: string): string[] {
  const walk = (list: FileTreeNode[], path: string[]): string[] | null => {
    for (const node of list) {
      if (node.id === id) return path;
      const found = node.children ? walk(node.children, [...path, node.id]) : null;
      if (found) return found;
    }
    return null;
  };
  return walk(nodes, []) ?? [];
}
