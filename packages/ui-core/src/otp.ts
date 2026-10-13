export type OtpCharset = "numeric" | "alphanumeric" | "any";

const ALLOWED: Record<OtpCharset, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[a-z0-9]/i,
  any: /\S/,
};

/** Keeps the characters the charset allows, in order, up to `length` (all of them when omitted). */
export function sanitizeOtp(
  text: string,
  charset: OtpCharset = "numeric",
  length = Infinity,
): string {
  const allowed = ALLOWED[charset];
  let out = "";
  for (const char of text) {
    if (out.length >= length) break;
    if (allowed.test(char)) out += char;
  }
  return out;
}

/**
 * Writes `text` into the code from `index`: each character takes the next cell, and a paste that
 * is longer than what is left is cut. Returns the new cells and the cell that should get focus
 * (the next empty one, or the last).
 */
export function fillOtp(
  cells: readonly string[],
  index: number,
  text: string,
  charset: OtpCharset = "numeric",
): { cells: string[]; focus: number } {
  const next = [...cells];
  const chars = Array.from(sanitizeOtp(text, charset, cells.length - index));
  chars.forEach((char, offset) => {
    next[index + offset] = char;
  });
  return { cells: next, focus: Math.min(index + chars.length, cells.length - 1) };
}

export interface OtpOptions {
  /** The cells, in order. Default: the `input` descendants of the root. */
  cells?: () => HTMLInputElement[];
  charset?: OtpCharset;
  /** Called on every change with the joined code (empty cells are skipped). */
  onChange?: (code: string) => void;
  /** Called when every cell is filled. */
  onComplete?: (code: string) => void;
}

export interface Otp {
  /** The code typed so far. */
  value(): string;
  /** Replaces the whole code (no callbacks). */
  setValue(code: string): void;
  destroy(): void;
}

/**
 * A one-time-code field made of single-character inputs: typing advances to the next cell, a paste
 * (or an autofill that dumps the code in one cell) spreads over the following cells, Backspace
 * clears and steps back, and the arrows, Home and End move between cells. Cells are selected on
 * focus so a new digit replaces the old one. Returns a controller.
 */
export function createOtp(root: HTMLElement, options: OtpOptions = {}): Otp {
  const charset = options.charset ?? "numeric";
  const cells = () =>
    options.cells?.() ?? Array.from(root.querySelectorAll<HTMLInputElement>("input"));
  const read = () => cells().map((cell) => cell.value);
  const indexOf = (target: EventTarget | null) => cells().indexOf(target as HTMLInputElement);
  const focusCell = (index: number) => {
    const cell = cells()[index];
    cell?.focus();
    cell?.select();
  };
  const publish = () => {
    const values = read();
    const code = values.join("");
    options.onChange?.(code);
    if (values.length > 0 && values.every((value) => value !== "")) options.onComplete?.(code);
  };
  const apply = (index: number, text: string) => {
    const filled = fillOtp(read(), index, text, charset);
    const all = cells();
    filled.cells.forEach((value, at) => {
      const cell = all[at];
      if (cell && cell.value !== value) cell.value = value;
    });
    focusCell(filled.focus);
    publish();
  };

  const onInput = (event: Event) => {
    const index = indexOf(event.target);
    if (index === -1) return;
    const cell = cells()[index] as HTMLInputElement;
    const typed = sanitizeOtp(cell.value, charset);
    if (typed === "") {
      cell.value = "";
      publish();
      return;
    }
    // A cell that already held a character receives the new one appended: keep the typed one.
    const inserted = (event as InputEvent).data
      ? sanitizeOtp((event as InputEvent).data ?? "", charset)
      : typed;
    cell.value = "";
    apply(index, inserted || typed);
  };
  const onPaste = (event: ClipboardEvent) => {
    const index = indexOf(event.target);
    if (index === -1) return;
    event.preventDefault();
    apply(index, event.clipboardData?.getData("text") ?? "");
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const index = indexOf(event.target);
    if (index === -1 || event.metaKey || event.ctrlKey || event.altKey) return;
    const all = cells();
    if (event.key === "Backspace") {
      const cell = all[index] as HTMLInputElement;
      event.preventDefault();
      if (cell.value !== "") {
        cell.value = "";
        publish();
      } else if (index > 0) {
        (all[index - 1] as HTMLInputElement).value = "";
        focusCell(index - 1);
        publish();
      }
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const rtl = getComputedStyle(root).direction === "rtl";
      const step = (event.key === "ArrowRight") === !rtl ? 1 : -1;
      const target = index + step;
      if (target >= 0 && target < all.length) {
        event.preventDefault();
        focusCell(target);
      }
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusCell(event.key === "Home" ? 0 : all.length - 1);
    }
  };
  const onFocusIn = (event: FocusEvent) => {
    if (indexOf(event.target) !== -1) (event.target as HTMLInputElement).select();
  };

  root.addEventListener("input", onInput);
  root.addEventListener("paste", onPaste);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("focusin", onFocusIn);
  return {
    value: () => read().join(""),
    setValue(code) {
      const text = sanitizeOtp(code, charset);
      cells().forEach((cell, at) => {
        cell.value = text.charAt(at);
      });
    },
    destroy() {
      root.removeEventListener("input", onInput);
      root.removeEventListener("paste", onPaste);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusin", onFocusIn);
    },
  };
}
