export type FileRejectionReason = "type" | "size";

export interface FileRejection {
  file: File;
  reason: FileRejectionReason;
}

/**
 * Whether `file` matches an accept list: exact MIME types, `image/*` wildcards, and `.ext`
 * suffixes (the last one extends the React kit and matches how `<input accept>` reads them).
 * An empty or missing list accepts everything.
 */
export function isTypeAllowed(
  file: Pick<File, "name" | "type">,
  accepted?: readonly string[],
): boolean {
  if (!accepted || accepted.length === 0) return true;
  const name = file.name.toLowerCase();
  return accepted.some((type) =>
    type.startsWith(".")
      ? name.endsWith(type.toLowerCase())
      : type.endsWith("/*")
        ? file.type.startsWith(type.slice(0, -1))
        : file.type === type,
  );
}

/** Splits files into the ones that pass the type and size rules and the rejected ones, in order. */
export function validateFiles(
  files: readonly File[],
  accepted?: readonly string[],
  maxSize?: number,
): { accepted: File[]; rejected: FileRejection[] } {
  const result = { accepted: [] as File[], rejected: [] as FileRejection[] };
  for (const file of files) {
    if (!isTypeAllowed(file, accepted)) result.rejected.push({ file, reason: "type" });
    else if (maxSize !== undefined && file.size > maxSize)
      result.rejected.push({ file, reason: "size" });
    else result.accepted.push(file);
  }
  return result;
}

export interface FileDropOptions {
  onFiles: (files: File[]) => void;
  /** Called with the rejected files; the caller composes the message. */
  onReject?: (rejections: FileRejection[]) => void;
  /** Called when a file drag enters or leaves the target. */
  onDraggingChange?: (dragging: boolean) => void;
  /** Accepted MIME types (`image/*` allowed) and `.ext` suffixes. */
  accept?: readonly string[];
  maxSize?: number;
  /** When false only the first dropped or picked file is considered. Default true. */
  multiple?: boolean;
  /** A disabled drop zone ignores drags and `open()`. */
  disabled?: () => boolean;
}

export interface FileDrop {
  /** Opens the native file picker, with the same rules as a drop. */
  open(): void;
  destroy(): void;
}

const hasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Drag-and-drop plus picker for files. Only file drags count (text and links are ignored), the
 * dragging flag does not flicker over children, and picked and dropped files share the validation.
 * Returns a controller; the picker input is created on demand and never attached to the page.
 */
export function createFileDrop(target: HTMLElement, options: FileDropOptions): FileDrop {
  const { multiple = true } = options;
  let depth = 0;
  let picker: HTMLInputElement | undefined;

  const setDragging = (next: boolean) => {
    if (next === depth > 0) return;
    options.onDraggingChange?.(next);
  };
  const process = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const { accepted, rejected } = validateFiles(
      multiple ? files : files.slice(0, 1),
      options.accept,
      options.maxSize,
    );
    if (rejected.length > 0) options.onReject?.(rejected);
    if (accepted.length > 0) options.onFiles(accepted);
  };

  const onEnter = (event: DragEvent) => {
    if (options.disabled?.() || !hasFiles(event)) return;
    event.preventDefault();
    setDragging(true);
    depth += 1;
  };
  const onOver = (event: DragEvent) => {
    if (options.disabled?.() || !hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    if (depth === 0) {
      setDragging(true);
      depth = 1;
    }
  };
  const onLeave = () => {
    if (depth === 0) return;
    depth -= 1;
    if (depth === 0) options.onDraggingChange?.(false);
  };
  const onDrop = (event: DragEvent) => {
    if (options.disabled?.() || !hasFiles(event)) return;
    event.preventDefault();
    const wasDragging = depth > 0;
    depth = 0;
    if (wasDragging) options.onDraggingChange?.(false);
    process(event.dataTransfer?.files);
  };

  target.addEventListener("dragenter", onEnter);
  target.addEventListener("dragover", onOver);
  target.addEventListener("dragleave", onLeave);
  target.addEventListener("drop", onDrop);
  return {
    open() {
      if (options.disabled?.()) return;
      if (!picker) {
        picker = target.ownerDocument.createElement("input");
        picker.type = "file";
        picker.addEventListener("change", () => {
          process(picker?.files);
          if (picker) picker.value = "";
        });
      }
      picker.multiple = multiple;
      picker.accept = options.accept?.join(",") ?? "";
      picker.click();
    },
    destroy() {
      target.removeEventListener("dragenter", onEnter);
      target.removeEventListener("dragover", onOver);
      target.removeEventListener("dragleave", onLeave);
      target.removeEventListener("drop", onDrop);
      picker = undefined;
      depth = 0;
    },
  };
}
