/** Copies text to the clipboard, with a hidden-textarea fallback for insecure or denied contexts. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      document.execCommand("copy");
    } finally {
      area.remove();
    }
  }
}

export interface Copier {
  /** Copies, then reports `copied` for `resetMs`. */
  copy(text: string): Promise<void>;
  readonly copied: boolean;
  destroy(): void;
}

/** Copy action that flags success for `resetMs` (the React kit's `useCopy`). */
export function createCopier(onChange?: (copied: boolean) => void, resetMs = 1600): Copier {
  let copied = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const set = (next: boolean) => {
    copied = next;
    onChange?.(next);
  };
  return {
    async copy(text) {
      await copyText(text);
      set(true);
      clearTimeout(timer);
      timer = setTimeout(() => set(false), resetMs);
    },
    get copied() {
      return copied;
    },
    destroy() {
      clearTimeout(timer);
    },
  };
}
