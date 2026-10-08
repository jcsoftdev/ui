"use client";

import { Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";

export type DropzoneRejectionReason = "type" | "size";

export interface DropzoneRejection {
  file: File;
  reason: DropzoneRejectionReason;
}

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
  className?: string;
}

function isTypeAllowed(file: File, acceptedTypes?: string[]) {
  if (!acceptedTypes || acceptedTypes.length === 0) return true;
  return acceptedTypes.some((type) =>
    type.endsWith("/*") ? file.type.startsWith(type.slice(0, -1)) : file.type === type,
  );
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
  className,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function process(list: FileList | null) {
    if (!list || list.length === 0) return;
    const { accepted, rejected } = validateFiles(Array.from(list), acceptedTypes, maxSizeBytes);
    if (rejected.length > 0) onReject?.(rejected);
    if (accepted.length > 0) onFiles(accepted);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    process(event.dataTransfer.files);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    process(event.target.files);
    event.target.value = "";
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the browse button is the keyboard-accessible path; dragging is an extra shortcut
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-tile border-[1.5px] border-line-control border-dashed bg-surface-2 p-5.5 text-center text-ink-2",
        dragging && "border-accent-ink bg-accent-soft",
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload aria-hidden="true" className="size-5.5" />
      <b className="text-control">{title}</b>
      {hint ? <span className="text-meta text-ink-3">{hint}</span> : null}
      <button
        type="button"
        className="mt-1 inline-flex h-control-height-sm items-center justify-center rounded-control border border-line-control bg-surface px-3 font-semibold text-chip-text hover:bg-surface-2"
        onClick={() => inputRef.current?.click()}
      >
        {browseLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes?.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />
    </div>
  );
}
