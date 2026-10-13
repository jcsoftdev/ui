// Contenteditable commands without a framework: bold, italic, underline, title, lists and links on
// top of `document.execCommand`, with every value that leaves the editor (and every paste) passing
// through the allowlist sanitizer. Port of the React kit's RichTextEditor logic.
import { htmlToText, isSafeUrl, sanitizeHtml } from "./sanitize-html.js";

export type RichTextCommand = "bold" | "italic" | "underline" | "h2" | "ul" | "ol";

/** Toolbar order. */
export const RICH_TEXT_COMMANDS: readonly RichTextCommand[] = [
  "bold",
  "italic",
  "underline",
  "h2",
  "ul",
  "ol",
];

export interface RichTextOptions {
  /** Seeds the editor (sanitized). */
  html?: string;
  /** Receives sanitized HTML, or "" when the editor is empty. Only fires on a real change. */
  onChange?: (html: string) => void;
  /** Fires when the set of active commands at the caret changes. */
  onActiveChange?: (active: ReadonlySet<RichTextCommand>) => void;
  /** Ctrl/Cmd+K was pressed; the host opens its link UI (call `saveSelection()` first or use this). */
  onLinkShortcut?: () => void;
}

export interface RichText {
  /** Runs a command on the current selection and emits the change. */
  exec(command: RichTextCommand): void;
  isActive(command: RichTextCommand): boolean;
  /** Sanitized HTML, "" when empty. */
  getHtml(): string;
  /** Replaces the content with sanitized HTML without emitting `onChange`. */
  setHtml(html: string): void;
  isEmpty(): boolean;
  /** Remembers the selection inside the editor, e.g. before focus moves to a link field. */
  saveSelection(): void;
  restoreSelection(): void;
  /** `href` of the link around the caret, if any. */
  linkAtSelection(): string | null;
  /** Links the selection (or inserts the URL as a link). Returns false for an unsafe URL. */
  applyLink(href: string): boolean;
  removeLink(): void;
  destroy(): void;
}
function blockName(doc: Document): string {
  return String(doc.queryCommandValue("formatBlock")).toLowerCase().replace(/[<>]/g, "");
}

function commandActive(doc: Document, command: RichTextCommand): boolean {
  switch (command) {
    case "h2":
      return blockName(doc) === "h2";
    case "ul":
      return doc.queryCommandState("insertUnorderedList");
    case "ol":
      return doc.queryCommandState("insertOrderedList");
    default:
      return doc.queryCommandState(command);
  }
}

function runCommand(doc: Document, command: RichTextCommand): void {
  switch (command) {
    case "h2":
      doc.execCommand("formatBlock", false, blockName(doc) === "h2" ? "p" : "h2");
      break;
    case "ul":
      doc.execCommand("insertUnorderedList");
      break;
    case "ol":
      doc.execCommand("insertOrderedList");
      break;
    default:
      doc.execCommand(command);
  }
}

/** Makes `editor` an editing surface. Call `destroy()` to remove every listener. */
export function createRichText(editor: HTMLElement, options: RichTextOptions = {}): RichText {
  const doc = editor.ownerDocument;
  const win = doc.defaultView as Window;
  let lastEmitted = "";
  let saved: Range | null = null;
  let active = new Set<RichTextCommand>();

  const selectionRange = (): Range | null => {
    const selection = win.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range : null;
  };

  const refreshActive = () => {
    if (!selectionRange()) return;
    const next = new Set(RICH_TEXT_COMMANDS.filter((command) => commandActive(doc, command)));
    if (next.size === active.size && [...next].every((command) => active.has(command))) return;
    active = next;
    options.onActiveChange?.(active);
  };

  const emit = () => {
    const clean = sanitizeHtml(editor.innerHTML);
    const out = htmlToText(clean) === "" ? "" : clean;
    if (out === lastEmitted) return;
    lastEmitted = out;
    options.onChange?.(out);
  };

  const setHtml = (html: string) => {
    const clean = sanitizeHtml(html);
    if (editor.innerHTML !== clean) editor.innerHTML = clean;
    lastEmitted = htmlToText(clean) === "" ? "" : clean;
  };

  /** Sanitized HTML for transferred data: its `text/html`, else its `text/plain` as paragraphs, else "". */
  const htmlFrom = (data: DataTransfer | null, fallbackText = ""): string => {
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
  };

  const insertClean = (clean: string): boolean => {
    if (!clean) return false;
    editor.focus();
    if (!selectionRange()) {
      const end = doc.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      win.getSelection()?.removeAllRanges();
      win.getSelection()?.addRange(end);
    }
    doc.execCommand("insertHTML", false, clean);
    emit();
    return true;
  };

  const caretAt = (x: number, y: number) => {
    const d = doc as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    const position = d.caretPositionFromPoint?.(x, y);
    if (position) {
      range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    } else {
      range = doc.caretRangeFromPoint?.(x, y) ?? null;
    }
    if (!range || !editor.contains(range.startContainer)) return;
    win.getSelection()?.removeAllRanges();
    win.getSelection()?.addRange(range);
  };

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    insertClean(htmlFrom(event.clipboardData));
  };

  // A drag that starts inside this editor moves its selection; one from elsewhere copies.
  let dragSource: Range | null = null;
  const onDragStart = () => {
    const range = selectionRange();
    dragSource = range && !range.collapsed ? range.cloneRange() : null;
  };
  const onDragEnd = () => {
    dragSource = null;
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const source = dragSource;
    dragSource = null;
    caretAt(event.clientX, event.clientY);
    if (source) {
      const target = selectionRange();
      if (target && source.isPointInRange(target.startContainer, target.startOffset)) return;
    }
    if (insertClean(htmlFrom(event.dataTransfer)) && source) {
      source.deleteContents();
      emit();
    }
  };

  // Anything the browser would insert by itself from foreign data goes through the sanitizer instead.
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
      const range = doc.createRange();
      range.setStart(target.startContainer, target.startOffset);
      range.setEnd(target.endContainer, target.endOffset);
      if (editor.contains(range.commonAncestorContainer)) {
        win.getSelection()?.removeAllRanges();
        win.getSelection()?.addRange(range);
      }
    }
    insertClean(htmlFrom(event.dataTransfer, event.data ?? ""));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "k" && options.onLinkShortcut) {
      event.preventDefault();
      saved = selectionRange()?.cloneRange() ?? null;
      options.onLinkShortcut();
    }
  };

  const restoreSelection = () => {
    editor.focus();
    const selection = win.getSelection();
    if (saved && selection) {
      selection.removeAllRanges();
      selection.addRange(saved);
    }
  };

  setHtml(options.html ?? "");
  editor.addEventListener("input", emit);
  editor.addEventListener("blur", emit);
  editor.addEventListener("paste", onPaste);
  editor.addEventListener("dragstart", onDragStart);
  editor.addEventListener("dragend", onDragEnd);
  editor.addEventListener("drop", onDrop);
  editor.addEventListener("beforeinput", onBeforeInput);
  editor.addEventListener("keydown", onKeyDown);
  doc.addEventListener("selectionchange", refreshActive);

  return {
    exec(command) {
      editor.focus();
      runCommand(doc, command);
      emit();
      refreshActive();
    },
    isActive: (command) => active.has(command),
    getHtml: () => lastEmitted,
    setHtml,
    isEmpty: () => lastEmitted === "",
    saveSelection() {
      saved = selectionRange()?.cloneRange() ?? null;
    },
    restoreSelection,
    linkAtSelection() {
      const node = (saved ?? selectionRange())?.commonAncestorContainer;
      const element = node instanceof Element ? node : node?.parentElement;
      return element?.closest("a")?.getAttribute("href") ?? null;
    },
    applyLink(href) {
      const url = href.trim();
      if (!isSafeUrl(url)) return false;
      restoreSelection();
      if (win.getSelection()?.isCollapsed) {
        const anchor = doc.createElement("a");
        anchor.setAttribute("href", url);
        anchor.textContent = url;
        doc.execCommand("insertHTML", false, sanitizeHtml(anchor.outerHTML));
      } else {
        doc.execCommand("createLink", false, url);
      }
      emit();
      return true;
    },
    removeLink() {
      restoreSelection();
      doc.execCommand("unlink");
      emit();
    },
    destroy() {
      editor.removeEventListener("input", emit);
      editor.removeEventListener("blur", emit);
      editor.removeEventListener("paste", onPaste);
      editor.removeEventListener("dragstart", onDragStart);
      editor.removeEventListener("dragend", onDragEnd);
      editor.removeEventListener("drop", onDrop);
      editor.removeEventListener("beforeinput", onBeforeInput);
      editor.removeEventListener("keydown", onKeyDown);
      doc.removeEventListener("selectionchange", refreshActive);
    },
  };
}
