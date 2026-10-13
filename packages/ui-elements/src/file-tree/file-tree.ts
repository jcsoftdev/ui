import {
  createTree,
  flattenTree,
  type Tree,
  type TreeNode,
  type TreeRow,
} from "@jcsoftdev/ui-core/tree";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
} from "../internal/base.js";
import { ICONS, isRtl } from "../internal/e11.js";
import css from "./file-tree.css.js";

export interface FileTreeNode extends TreeNode {
  children?: FileTreeNode[];
  /** A branch whose children are fetched with `loadChildren` the first time it opens. */
  lazy?: boolean;
}

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);
const CODE = new Set(["ts", "tsx", "js", "jsx", "json", "css", "html"]);
const TEXT = new Set(["md", "txt", "csv", "pdf"]);

const fileIcon = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE.has(ext)) return ICONS.fileImage;
  if (CODE.has(ext)) return ICONS.fileCode;
  if (TEXT.has(ext)) return ICONS.fileText;
  return ICONS.file;
};

const findNode = (nodes: readonly FileTreeNode[], id: string): FileTreeNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children ? findNode(node.children, id) : undefined;
    if (found) return found;
  }
  return undefined;
};

/** The caller's nodes with loaded children merged in; the caller's objects are never touched. */
const withLoaded = (
  nodes: readonly FileTreeNode[],
  loaded: ReadonlyMap<string, FileTreeNode[]>,
): FileTreeNode[] =>
  nodes.map((node) => {
    const children = loaded.get(node.id) ?? node.children ?? (node.lazy ? [] : undefined);
    return children ? { ...node, children: withLoaded(children, loaded) } : node;
  });

/**
 * `<ui-file-tree>`: an expandable tree following the WAI-ARIA tree pattern, driven by data. One
 * tab stop with roving focus; arrows move and open or close (mirrored in right-to-left), Home/End,
 * typeahead by name, Enter or Space select (and toggle a folder), a click does both. The keyboard
 * model is ui-core's `tree`.
 *
 * Properties: `nodes` (`{ id, name, children?, lazy? }[]`; a node with `children` is a folder),
 * `selectedId`, `expandedIds`, and `loadChildren(node)`, an async function that returns the children
 * of a `lazy` folder the first time it opens (the row is `aria-busy` meanwhile; a rejection closes
 * it again and fires `loaderror`). Attributes: `label` (accessible name), `selected` and `expanded`
 * (space-separated ids, initial values). Events: `select` with `{ id, node }`, `expandedchange`
 * with `{ ids }`, `loaderror` with `{ id, error }`.
 */
export class UiFileTree extends ElementBase {
  static observedAttributes = ["label", "selected", "expanded"];
  #list = document.createElement("div");
  #nodes: FileTreeNode[] = [];
  #selected: string | null = null;
  #expanded = new Set<string>();
  #loading = new Set<string>();
  #loaded = new Map<string, FileTreeNode[]>();
  #view: FileTreeNode[] = [];
  #tree: Tree | undefined;
  #loader: ((node: FileTreeNode) => Promise<FileTreeNode[]>) | undefined;

  constructor() {
    super();
    this.#list.dataset.uiPart = "tree";
    this.#list.setAttribute("role", "tree");
  }

  get nodes(): FileTreeNode[] {
    return this.#nodes;
  }
  set nodes(value: FileTreeNode[]) {
    this.#nodes = value;
    this.#loaded.clear();
    this.#render();
    this.#loadOpen();
  }
  get selectedId(): string | null {
    return this.#selected;
  }
  set selectedId(value: string | null) {
    this.#selected = value;
    this.#render();
  }
  get expandedIds(): string[] {
    return [...this.#expanded];
  }
  set expandedIds(value: string[]) {
    this.#expanded = new Set(value);
    this.#render();
    this.#loadOpen();
  }
  get loadChildren(): ((node: FileTreeNode) => Promise<FileTreeNode[]>) | undefined {
    return this.#loader;
  }
  set loadChildren(value: ((node: FileTreeNode) => Promise<FileTreeNode[]>) | undefined) {
    this.#loader = value;
    this.#loadOpen();
  }

  connectedCallback(): void {
    this.dataset.ui = "file-tree";
    adoptStyles(rootOf(this), css);
    this.append(this.#list);
    this.#selected ??= this.getAttribute("selected");
    if (this.#expanded.size === 0) {
      for (const id of (this.getAttribute("expanded") ?? "").split(/\s+/).filter(Boolean))
        this.#expanded.add(id);
    }
    this.#tree = createTree(this.#list, {
      nodes: () => this.#view,
      expanded: () => this.#expanded,
      selected: () => this.#selected,
      rtl: () => isRtl(this),
      onSelect: (id, node) => {
        this.#selected = id;
        this.#render();
        emit(this, "select", { id, node });
      },
      onExpandedChange: (ids) => this.#setExpanded(ids),
    });
    this.#render();
    this.#loadOpen();
  }

  disconnectedCallback(): void {
    this.#tree?.destroy();
    this.#tree = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (name === "selected") this.#selected = this.getAttribute("selected");
    if (name === "expanded")
      this.#expanded = new Set((this.getAttribute("expanded") ?? "").split(/\s+/).filter(Boolean));
    if (this.isConnected) {
      this.#render();
      this.#loadOpen();
    }
  }

  #setExpanded(ids: string[]): void {
    this.#expanded = new Set(ids);
    this.#render();
    emit(this, "expandedchange", { ids: [...ids] });
    this.#loadOpen();
  }

  /** Lazy folders that are open (set from an attribute, a property or the keyboard) load now. */
  #loadOpen(): void {
    for (const id of this.#expanded) void this.#load(id);
  }

  async #load(id: string): Promise<void> {
    const node = findNode(this.#nodes, id);
    if (!node?.lazy || !this.#loader || this.#loading.has(id) || this.#loaded.has(id)) return;
    const owner = this.#nodes;
    this.#loading.add(id);
    this.#render();
    try {
      const children = await this.#loader(node);
      // The data may have been replaced meanwhile; a stale answer is dropped.
      if (this.#nodes === owner && findNode(this.#nodes, id)) this.#loaded.set(id, children);
    } catch (error) {
      if (this.#nodes === owner) {
        this.#expanded.delete(id);
        emit(this, "loaderror", { id, error });
        emit(this, "expandedchange", { ids: [...this.#expanded] });
      }
    } finally {
      this.#loading.delete(id);
      this.#render();
    }
  }

  #render(): void {
    const label = this.getAttribute("label");
    if (label) this.#list.setAttribute("aria-label", label);
    else this.#list.removeAttribute("aria-label");
    const active = this.#list.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.nodeId
      : undefined;
    this.#view = withLoaded(this.#nodes, this.#loaded);
    const rows = flattenTree(this.#view, this.#expanded);
    this.#list.replaceChildren(...rows.map((row) => this.#row(row as TreeRow<FileTreeNode>)));
    this.#tree?.update();
    if (!active) return;
    // A focused row that vanished (its folder closed, its node removed) hands focus to the tab stop.
    const target = rows.some((row) => row.node.id === active) ? active : this.#tree?.tabStop();
    if (target) this.#tree?.focus(target);
  }

  #row(row: TreeRow<FileTreeNode>): HTMLElement {
    const { node } = row;
    const el = document.createElement("div");
    el.dataset.nodeId = node.id;
    el.style.setProperty("--ui-file-tree-depth", String(row.depth - 1));
    if (row.isBranch) el.dataset.branch = "";
    if (this.#loading.has(node.id)) el.setAttribute("aria-busy", "true");
    const chevron = document.createElement("span");
    chevron.dataset.uiPart = "chevron";
    if (row.isBranch) chevron.innerHTML = ICONS.chevron;
    const icon = document.createElement("span");
    icon.dataset.uiPart = "icon";
    icon.innerHTML = row.isBranch
      ? row.expanded
        ? ICONS.folderOpen
        : ICONS.folder
      : fileIcon(node.name);
    const name = document.createElement("span");
    name.dataset.uiPart = "name";
    name.textContent = node.name;
    el.append(chevron, icon, name);
    return el;
  }
}

/** Registers `<ui-file-tree>` (or `<prefix>-file-tree`) and returns the tag. */
export function defineFileTree(options?: DefineOptions): string {
  return defineElement("file-tree", UiFileTree, options);
}
