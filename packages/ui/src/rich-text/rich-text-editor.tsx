"use client";

import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline,
  Unlink,
} from "../icons/index.js";
import type { ClassNames } from "../utils/class-names.js";
import { cn } from "../utils/cn.js";
import { htmlToText, isSafeUrl, sanitizeHtml } from "./sanitize.js";

/** Typography for editor and read-only content; preflight resets lists and headings. */
export const richTextContentClass =
  "text-body text-ink [&_a]:text-accent-ink [&_a]:underline [&_blockquote]:border-line-strong [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 [&_h2]:font-semibold [&_h2]:text-card-title [&_h3]:font-semibold [&_h3]:text-row-title [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [overflow-wrap:anywhere]";

type Command = "bold" | "italic" | "underline" | "ul" | "ol" | "h2";

export type RichTextEditorPart =
  | "root"
  | "toolbar"
  | "tool"
  | "linkForm"
  | "linkInput"
  | "linkApply"
  | "linkRemove"
  | "body"
  | "placeholder"
  | "content";

export interface RichTextEditorProps {
  /** Controlled HTML. It is sanitized before it reaches the editor. */
  value?: string;
  defaultValue?: string;
  /** Receives sanitized HTML, or "" when the editor is empty. */
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Minimum height of the editing area, in rem. */
  minHeightRem?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<RichTextEditorPart>;
}

const COMMANDS: Record<
  Command,
  { label: string; shortcut?: string; icon: ReactNode; run: () => void; active: () => boolean }
> = {
  bold: {
    label: "Negrita",
    shortcut: "Ctrl+B",
    icon: <Bold />,
    run: () => document.execCommand("bold"),
    active: () => document.queryCommandState("bold"),
  },
  italic: {
    label: "Cursiva",
    shortcut: "Ctrl+I",
    icon: <Italic />,
    run: () => document.execCommand("italic"),
    active: () => document.queryCommandState("italic"),
  },
  underline: {
    label: "Subrayado",
    shortcut: "Ctrl+U",
    icon: <Underline />,
    run: () => document.execCommand("underline"),
    active: () => document.queryCommandState("underline"),
  },
  h2: {
    label: "Título",
    icon: <Heading2 />,
    run: () => {
      const inHeading = blockName() === "h2";
      document.execCommand("formatBlock", false, inHeading ? "p" : "h2");
    },
    active: () => blockName() === "h2",
  },
  ul: {
    label: "Lista con viñetas",
    icon: <List />,
    run: () => document.execCommand("insertUnorderedList"),
    active: () => document.queryCommandState("insertUnorderedList"),
  },
  ol: {
    label: "Lista numerada",
    icon: <ListOrdered />,
    run: () => document.execCommand("insertOrderedList"),
    active: () => document.queryCommandState("insertOrderedList"),
  },
};

const ORDER: Command[] = ["bold", "italic", "underline", "h2", "ul", "ol"];

function blockName(): string {
  const value = document.queryCommandValue("formatBlock");
  return String(value).toLowerCase().replace(/[<>]/g, "");
}

function selectionIn(root: HTMLElement | null): Range | null {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer) ? range : null;
}

/** Sanitized HTML for transferred data: its `text/html`, else its `text/plain` as paragraphs, else "". */
function htmlFromTransfer(data: DataTransfer | null, fallbackText = ""): string {
  const html = data?.getData("text/html") ?? "";
  const text = data?.getData("text/plain") || fallbackText;
  if (html) return sanitizeHtml(html);
  if (!text) return "";
  return sanitizeHtml(
    text
      .split(/\r?\n/)
      .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
      .join(""),
  );
}

/** Moves the caret to the point under the pointer, when that point is inside `root`. */
function placeCaretAt(root: HTMLElement, x: number, y: number) {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let range: Range | null = null;
  const position = d.caretPositionFromPoint?.(x, y);
  if (position) {
    range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
  } else {
    range = document.caretRangeFromPoint?.(x, y) ?? null;
  }
  if (!range || !root.contains(range.startContainer)) return;
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

/**
 * Rich text editor on a plain `contenteditable`, with no dependencies. Supports bold, italic,
 * underline, a title, bullet and numbered lists and links (Ctrl/Cmd+B, I, U, K). Everything that
 * leaves the editor, including pasted content, goes through `sanitizeHtml`.
 *
 * It uses `document.execCommand`: deprecated on paper but still the only dependency-free way to
 * edit rich text natively, and implemented by every engine.
 */
export function RichTextEditor({
  value,
  defaultValue = "",
  onChange,
  placeholder = "Escribe aquí…",
  disabled,
  minHeightRem = 8,
  className,
  classNames,
  ...aria
}: RichTextEditorProps) {
  const baseId = useId();
  const editor = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const dragSource = useRef<Range | null>(null);
  const lastEmitted = useRef<string>("");
  const [empty, setEmpty] = useState(() => htmlToText(sanitizeHtml(value ?? defaultValue)) === "");
  const [active, setActive] = useState<Set<Command>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: defaultValue only seeds the first render
  useLayoutEffect(() => {
    const node = editor.current;
    if (!node) return;
    const clean = sanitizeHtml(value ?? defaultValue);
    if (value === undefined || clean !== lastEmitted.current) {
      if (node.innerHTML !== clean) node.innerHTML = clean;
      lastEmitted.current = clean;
      setEmpty(htmlToText(clean) === "");
    }
  }, [value]);

  const refreshActive = useCallback(() => {
    if (!selectionIn(editor.current)) return;
    const next = new Set<Command>();
    for (const key of ORDER) if (COMMANDS[key].active()) next.add(key);
    setActive(next);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const emit = useCallback(() => {
    const node = editor.current;
    if (!node) return;
    const clean = sanitizeHtml(node.innerHTML);
    const isEmpty = htmlToText(clean) === "";
    setEmpty(isEmpty);
    const out = isEmpty ? "" : clean;
    if (out !== lastEmitted.current) {
      lastEmitted.current = out;
      onChange?.(out);
    }
  }, [onChange]);

  const exec = (key: Command) => {
    editor.current?.focus();
    COMMANDS[key].run();
    emit();
    refreshActive();
  };

  const openLink = () => {
    const range = selectionIn(editor.current);
    savedRange.current = range ? range.cloneRange() : null;
    const anchor =
      range?.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer.closest("a")
        : range?.commonAncestorContainer.parentElement?.closest("a");
    setLinkValue(anchor?.getAttribute("href") ?? "https://");
    setLinkError(false);
    setLinkOpen(true);
    queueMicrotask(() => linkInput.current?.select());
  };

  const restoreSelection = () => {
    editor.current?.focus();
    const range = savedRange.current;
    const selection = window.getSelection();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const closeLink = () => {
    setLinkOpen(false);
    restoreSelection();
  };

  const applyLink = () => {
    const href = linkValue.trim();
    if (!isSafeUrl(href)) {
      setLinkError(true);
      return;
    }
    restoreSelection();
    const selection = window.getSelection();
    if (selection?.isCollapsed) {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", href);
      anchor.textContent = href;
      document.execCommand("insertHTML", false, sanitizeHtml(anchor.outerHTML));
    } else {
      document.execCommand("createLink", false, href);
    }
    setLinkOpen(false);
    emit();
  };

  const removeLink = () => {
    restoreSelection();
    document.execCommand("unlink");
    setLinkOpen(false);
    emit();
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openLink();
    }
  };

  const insertClean = useCallback(
    (clean: string): boolean => {
      const node = editor.current;
      if (!clean || !node) return false;
      node.focus();
      if (!selectionIn(node)) {
        const end = document.createRange();
        end.selectNodeContents(node);
        end.collapse(false);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(end);
      }
      document.execCommand("insertHTML", false, clean);
      emit();
      return true;
    },
    [emit],
  );

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    insertClean(htmlFromTransfer(event.clipboardData));
  };

  // A drag that starts inside this editor moves its selection; one from elsewhere copies.
  const onDragStart = () => {
    const range = selectionIn(editor.current);
    dragSource.current = range && !range.collapsed ? range.cloneRange() : null;
  };

  const onDragEnd = () => {
    dragSource.current = null;
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const source = dragSource.current;
    dragSource.current = null;
    if (editor.current) placeCaretAt(editor.current, event.clientX, event.clientY);
    if (source) {
      const target = selectionIn(editor.current);
      if (target && source.isPointInRange(target.startContainer, target.startOffset)) return;
    }
    if (insertClean(htmlFromTransfer(event.dataTransfer)) && source) {
      source.deleteContents();
      emit();
    }
  };

  // Whatever the browser would insert by itself from foreign data goes through the sanitizer.
  // React's onBeforeInput is not the native event, so this listens directly.
  useEffect(() => {
    const node = editor.current;
    if (!node) return;
    const onBeforeInput = (event: InputEvent) => {
      if (
        event.inputType !== "insertFromDrop" &&
        event.inputType !== "insertFromPaste" &&
        event.inputType !== "insertReplacementText"
      )
        return;
      event.preventDefault();
      const target = event.getTargetRanges?.()[0];
      if (target && event.inputType === "insertReplacementText") {
        const range = document.createRange();
        range.setStart(target.startContainer, target.startOffset);
        range.setEnd(target.endContainer, target.endOffset);
        if (node.contains(range.commonAncestorContainer)) {
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
      }
      insertClean(htmlFromTransfer(event.dataTransfer, event.data ?? ""));
    };
    node.addEventListener("beforeinput", onBeforeInput);
    return () => node.removeEventListener("beforeinput", onBeforeInput);
  }, [insertClean]);

  const onToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      toolbar.current?.querySelectorAll<HTMLButtonElement>("button[data-tool]") ?? [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    let next = at;
    if (event.key === "ArrowRight") next = (at + 1) % buttons.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    setFocusIndex(next);
    buttons[next]?.focus();
  };

  const tools: {
    id: string;
    label: string;
    icon: ReactNode;
    pressed?: boolean;
    run: () => void;
  }[] = ORDER.map((key) => {
    const command = COMMANDS[key];
    return {
      id: key,
      label: command.shortcut ? `${command.label} (${command.shortcut})` : command.label,
      icon: command.icon,
      pressed: active.has(key),
      run: () => exec(key),
    };
  });
  tools.push({
    id: "link",
    label: "Enlace (Ctrl+K)",
    icon: <Link2 />,
    pressed: linkOpen,
    run: openLink,
  });

  return (
    <div
      className={cn(
        "@container/rte flex w-full min-w-0 flex-col overflow-hidden rounded-input border-control bg-surface-control focus-within:outline-2 focus-within:outline-accent-ink focus-within:-outline-offset-1",
        disabled && "opacity-60",
        classNames?.root,
        className,
      )}
    >
      <div
        ref={toolbar}
        role="toolbar"
        aria-label="Formato"
        aria-controls={`${baseId}-editor`}
        onKeyDown={onToolbarKeyDown}
        className={cn(
          "flex flex-wrap items-center gap-0.5 border-b-divider p-1",
          classNames?.toolbar,
        )}
      >
        {tools.map((tool, index) => (
          <button
            key={tool.id}
            type="button"
            data-tool={tool.id}
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={tool.pressed}
            disabled={disabled}
            tabIndex={index === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(index)}
            // Keep the editor selection while pressing a toolbar button.
            onMouseDown={(event) => event.preventDefault()}
            onClick={tool.run}
            className={cn(
              "pressable grid size-8 place-items-center rounded-button text-ink-2 hover:bg-surface-sunken hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed aria-pressed:bg-accent-soft aria-pressed:text-accent-ink [&_svg]:size-4",
              classNames?.tool,
            )}
          >
            {tool.icon}
          </button>
        ))}
        {linkOpen ? (
          <form
            className={cn(
              "flex min-w-0 basis-full items-center gap-1 pt-1 @md/rte:basis-auto @md/rte:flex-1 @md/rte:pt-0",
              classNames?.linkForm,
            )}
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <input
              ref={linkInput}
              type="url"
              value={linkValue}
              aria-label="Dirección del enlace"
              aria-invalid={linkError || undefined}
              onChange={(event) => {
                setLinkValue(event.target.value);
                setLinkError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeLink();
                }
              }}
              className={cn(
                "h-control-sm min-w-0 flex-1 rounded-input border-control bg-surface-control px-2 text-control text-ink focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
                classNames?.linkInput,
              )}
            />
            <button
              type="submit"
              className={cn(
                "h-control-sm rounded-button bg-accent px-2.5 font-semibold text-control text-on-accent focus-visible:focus-ring",
                classNames?.linkApply,
              )}
            >
              Aplicar
            </button>
            <button
              type="button"
              title="Quitar enlace"
              aria-label="Quitar enlace"
              onClick={removeLink}
              className={cn(
                "grid size-8 place-items-center rounded-button text-ink-2 hover:bg-surface-sunken focus-visible:focus-ring [&_svg]:size-4",
                classNames?.linkRemove,
              )}
            >
              <Unlink />
            </button>
          </form>
        ) : null}
      </div>
      <div className={cn("relative", classNames?.body)}>
        {empty ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 left-0 px-3 py-2 text-body text-ink-3",
              classNames?.placeholder,
            )}
          >
            {placeholder}
          </span>
        ) : null}
        {/* biome-ignore lint/a11y/useSemanticElements: contenteditable region; textarea cannot hold rich content */}
        <div
          ref={editor}
          id={`${baseId}-editor`}
          role="textbox"
          aria-multiline="true"
          aria-label={aria["aria-label"]}
          aria-labelledby={aria["aria-labelledby"]}
          aria-disabled={disabled || undefined}
          contentEditable={!disabled}
          suppressContentEditableWarning
          tabIndex={disabled ? -1 : 0}
          spellCheck
          onInput={emit}
          onPaste={onPaste}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onKeyDown={onEditorKeyDown}
          onBlur={emit}
          style={{ minHeight: `${minHeightRem}rem` }}
          className={cn("w-full px-3 py-2 outline-none", richTextContentClass, classNames?.content)}
        />
      </div>
    </div>
  );
}

export interface RichTextViewProps {
  html: string;
  className?: string;
}

/** Read-only rendering of editor output; sanitizes again so stored HTML is never trusted. */
export function RichTextView({ html, className }: RichTextViewProps) {
  return (
    <div
      className={cn(richTextContentClass, className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content passes through the allowlist sanitizer
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
