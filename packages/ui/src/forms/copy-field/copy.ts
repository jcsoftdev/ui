interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/** Writes `value` to the clipboard; resolves `false` when it is unavailable or the write is refused. */
export async function copyText(
  value: string,
  clipboard: ClipboardLike | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
