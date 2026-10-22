"use client";

import {
  type ChangeEvent,
  type ChangeEventHandler,
  type DragEvent,
  type MouseEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import { Upload, X } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type DropzoneRejectionReason = "type" | "size";

export interface DropzoneRejection {
  file: File;
  reason: DropzoneRejectionReason;
}

export type DropzonePart = "root" | "icon" | "title" | "hint" | "browse" | "list" | "file";

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  /** Called with the rejected files; the caller composes the user-facing message. */
  onReject?: (rejections: DropzoneRejection[]) => void;
  /** Accepted MIME types; supports wildcards such as `image/*`. */
  acceptedTypes?: string[];
  maxSizeBytes?: number;
  multiple?: boolean;
  title: string;
  hint?: string;
  browseLabel: string;
  /**
   * `zone` (default): a drop target with a browse button. `field`: a form control. The real
   * `<input type="file">` is the focusable, labelled element (Tab to it, Enter or Space opens the picker, a
   * `Field` label points at it), clicking anywhere in the box opens the picker, the selection stays in the
   * input so `name` submits it, and the props below apply.
   */
  mode?: "zone" | "field";
  /**
   * Accepted file types as the native `accept` attribute: MIME types, wildcards and extensions
   * (".pdf,image/*"). Validated like `acceptedTypes`; both can be given.
   */
  accept?: string;
  /** Field mode: id of the file input (`Field` sets it). */
  id?: string;
  /** Field mode: name the selected files are submitted under. */
  name?: string;
  /** Field mode: native change event of the input, after rejected files were dropped from it. */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** Field mode: lists the selected files, each with a remove button. */
  showFiles?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<DropzonePart>;
}

function isTypeAllowed(file: File, acceptedTypes?: string[]) {
  if (!acceptedTypes || acceptedTypes.length === 0) return true;
  return acceptedTypes.some((type) => {
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type.toLowerCase());
    return type.endsWith("/*") ? file.type.startsWith(type.slice(0, -1)) : file.type === type;
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Puts `files` into a file input; browsers only accept a `FileList` built through a `DataTransfer`. */
function setInputFiles(input: HTMLInputElement, files: File[]) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}

function validateFiles(
  files: File[],
  acceptedTypes: string[] | undefined,
  maxSizeBytes: number | undefined,
) {
  const accepted: File[] = [];
  const rejected: DropzoneRejection[] = [];

  for (const file of files) {
    if (!isTypeAllowed(file, acceptedTypes)) {
      rejected.push({ file, reason: "type" });
    } else if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
      rejected.push({ file, reason: "size" });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}

export function Dropzone({
  onFiles,
  onReject,
  acceptedTypes,
  maxSizeBytes,
  multiple = true,
  title,
  hint,
  browseLabel,
  mode = "zone",
  accept,
  id,
  name,
  onChange,
  showFiles,
  disabled,
  required,
  invalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  classNames,
}: DropzoneProps) {
  const strings = useUiStrings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);
  const autoId = useId();
  const inputId = id ?? autoId;
  const field = mode === "field";
  const types = [
    ...(acceptedTypes ?? []),
    ...(accept
      ?.split(",")
      .map((type) => type.trim())
      .filter(Boolean) ?? []),
  ];

  // A form reset empties the input; keep the visible list in step.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!field || !form) return;
    const reset = () => setSelected([]);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [field]);

  function process(list: FileList | File[] | null) {
    if (!list || list.length === 0) return [];
    const { accepted, rejected } = validateFiles(Array.from(list), types, maxSizeBytes);
    if (rejected.length > 0) onReject?.(rejected);
    if (accepted.length > 0) onFiles(accepted);
    return accepted;
  }

  /** Field mode: runs the change through the input so `onChange` and form submission see one state. */
  function assign(files: File[]) {
    const input = inputRef.current;
    if (!input || disabled) return;
    setInputFiles(input, multiple ? files : files.slice(0, 1));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (field) assign(Array.from(event.dataTransfer.files));
    else process(event.dataTransfer.files);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (!field) {
      process(event.target.files);
      event.target.value = "";
      return;
    }
    const accepted = process(event.target.files);
    const picked = event.target.files?.length ?? 0;
    // Rejected files leave the input too, so the form never submits them.
    if (accepted.length !== picked) setInputFiles(event.target, accepted);
    setSelected(accepted);
    onChange?.(event);
  }

  function openPicker(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (!field || disabled || target === inputRef.current || target.closest("[data-dropzone-list]"))
      return;
    inputRef.current?.click();
  }

  const titleId = `${inputId}-title`;
  const hintId = `${inputId}-hint`;

  const browse = cn(
    "mt-1 inline-flex h-control-sm max-w-full items-center justify-center rounded-input border-control bg-surface-control px-3 font-semibold text-chip-text hover:bg-surface-2",
    classNames?.browse,
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the file input inside is the keyboard path; the click only forwards to it
    // biome-ignore lint/a11y/noStaticElementInteractions: in zone mode the browse button is the keyboard path and in field mode the file input is; dragging and clicking the box are shortcuts
    <div
      className={cn(
        "@container/dropzone flex min-w-0 flex-col items-center gap-1.5 rounded-tile border-[1.5px] border-line-control border-dashed bg-surface-2 p-3 text-center text-ink-2 @min-[360px]/dropzone:p-5.5",
        dragging && "border-accent-ink bg-accent-soft",
        field &&
          "cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent-ink",
        field && (invalid || ariaInvalid) && "border-danger",
        field && disabled && "cursor-not-allowed opacity-50",
        classNames?.root,
        className,
      )}
      onClick={openPicker}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload
        aria-hidden="true"
        className={cn("size-4.5 @min-[360px]/dropzone:size-5.5", classNames?.icon)}
      />
      <b
        id={titleId}
        className={cn("max-w-full text-control [overflow-wrap:anywhere]", classNames?.title)}
      >
        {title}
      </b>
      {hint ? (
        <span
          id={hintId}
          className={cn(
            "max-w-full text-meta text-ink-3 [overflow-wrap:anywhere]",
            classNames?.hint,
          )}
        >
          {hint}
        </span>
      ) : null}
      {field ? (
        <span aria-hidden="true" className={browse}>
          {browseLabel}
        </span>
      ) : (
        <button type="button" className={browse} onClick={() => inputRef.current?.click()}>
          {browseLabel}
        </button>
      )}
      {field && showFiles && selected.length > 0 ? (
        <ul
          data-dropzone-list=""
          className={cn(
            "flex w-full min-w-0 cursor-default flex-col gap-1 text-left",
            classNames?.list,
          )}
        >
          {selected.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-input bg-surface-control px-2 py-1 text-meta text-ink",
                classNames?.file,
              )}
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-ink-3 tabular-nums">{formatBytes(file.size)}</span>
              <button
                type="button"
                aria-label={`${strings.remove} ${file.name}`}
                disabled={disabled}
                className="grid size-6 shrink-0 place-items-center rounded-button text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:focus-ring"
                onClick={() => assign(selected.filter((_, at) => at !== index))}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {field ? (
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={types.join(",") || undefined}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={
            [ariaDescribedBy, titleId, hint ? hintId : undefined].filter(Boolean).join(" ") ||
            undefined
          }
          aria-invalid={ariaInvalid ?? (invalid || undefined)}
          onChange={handleInputChange}
        />
      ) : (
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={types.join(",") || undefined}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleInputChange}
        />
      )}
    </div>
  );
}
