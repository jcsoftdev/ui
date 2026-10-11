"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  File,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  type IconComponent,
} from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import {
  type FileTreeNode,
  type FlatRow,
  flattenTree,
  type TreeKey,
  treeStep,
  typeahead,
} from "./model.js";

export interface FileTreeProps {
  nodes: FileTreeNode[];
  /** Accessible name of the tree. */
  label: string;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string, node: FileTreeNode) => void;
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  className?: string;
}

const TREE_KEYS: readonly string[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
];

function iconFor(name: string): IconComponent {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return FileImage;
  if (["ts", "tsx", "js", "jsx", "json", "css", "html"].includes(ext)) return FileCode;
  if (["md", "txt", "csv", "pdf"].includes(ext)) return FileText;
  return File;
}

/**
 * Expandable tree following the WAI-ARIA tree pattern: one tab stop with roving focus,
 * arrows to move and open/close, Home/End, type-ahead, Enter or Space to select.
 */
export function FileTree({
  nodes,
  label,
  selectedId: selectedProp,
  defaultSelectedId = null,
  onSelect,
  expandedIds: expandedProp,
  defaultExpandedIds = [],
  onExpandedChange,
  className,
}: FileTreeProps) {
  const [selectedState, setSelectedState] = useState(defaultSelectedId);
  const [expandedState, setExpandedState] = useState(defaultExpandedIds);
  const selected = selectedProp !== undefined ? selectedProp : selectedState;
  const expandedList = expandedProp ?? expandedState;
  const expanded = useMemo(() => new Set(expandedList), [expandedList]);
  const rows = useMemo(() => flattenTree(nodes, expanded), [nodes, expanded]);

  const [focusId, setFocusId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const tabStop =
    rows.find((r) => r.node.id === focusId)?.node.id ??
    rows.find((r) => r.node.id === selected)?.node.id ??
    rows[0]?.node.id;

  const setExpanded = (ids: string[]) => {
    if (expandedProp === undefined) setExpandedState(ids);
    onExpandedChange?.(ids);
  };
  const toggle = (id: string, open: boolean) => {
    const next = expandedList.filter((x) => x !== id);
    if (open) next.push(id);
    setExpanded(next);
  };
  const select = (row: FlatRow) => {
    if (selectedProp === undefined) setSelectedState(row.node.id);
    onSelect?.(row.node.id, row.node);
  };
  const focusRow = (id: string) => {
    setFocusId(id);
    listRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, row: FlatRow) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (TREE_KEYS.includes(event.key)) {
      event.preventDefault();
      const step = treeStep(rows, row.node.id, event.key as TreeKey);
      if (!step) return;
      if (step.type === "focus") focusRow(step.id);
      else toggle(step.id, step.type === "expand");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(row);
      if (row.isFolder) toggle(row.node.id, !row.expanded);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const now = Date.now();
      const state = typed.current;
      state.text = now - state.at > 600 ? event.key : state.text + event.key;
      state.at = now;
      const match = typeahead(rows, row.node.id, state.text);
      if (match) focusRow(match);
    }
  };

  return (
    <div className={cn("@container/tree min-w-0", className)}>
      <div ref={listRef} role="tree" aria-label={label} className="flex flex-col gap-0.5">
        {rows.map((row) => {
          const isSelected = row.node.id === selected;
          const Icon = row.isFolder ? (row.expanded ? FolderOpen : Folder) : iconFor(row.node.name);
          return (
            <div
              key={row.node.id}
              role="treeitem"
              data-node-id={row.node.id}
              tabIndex={row.node.id === tabStop ? 0 : -1}
              aria-level={row.depth}
              aria-posinset={row.position}
              aria-setsize={row.setSize}
              aria-expanded={row.isFolder ? row.expanded : undefined}
              aria-selected={isSelected}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget) onKeyDown(event, row);
              }}
              onFocus={(event) => {
                if (event.target === event.currentTarget) setFocusId(row.node.id);
              }}
              onClick={() => {
                select(row);
                if (row.isFolder) toggle(row.node.id, !row.expanded);
                setFocusId(row.node.id);
              }}
              style={{ paddingInlineStart: `calc(${row.depth - 1} * 1rem + var(--pad-control-x))` }}
              className={cn(
                "pressable flex min-h-control-sm min-w-0 cursor-pointer items-center gap-density-sm rounded-button pe-control-x text-body text-ink outline-none hover:bg-surface-2 focus-visible:focus-ring",
                isSelected && "bg-accent-soft font-semibold text-accent-ink shadow-selected",
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center text-ink-3">
                {row.isFolder ? (
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 transition-transform duration-(--motion-duration) ease-style",
                      row.expanded && "rotate-90",
                    )}
                  />
                ) : null}
              </span>
              <Icon
                aria-hidden="true"
                className={cn("size-4 shrink-0", row.isFolder ? "text-accent-ink" : "text-ink-3")}
              />
              <span className="min-w-0 truncate">{row.node.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
