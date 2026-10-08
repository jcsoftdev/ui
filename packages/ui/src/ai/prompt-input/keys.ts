export interface SubmitKeyEvent {
  key: string;
  shiftKey: boolean;
  /** True while an IME composition is open (Enter confirms the composition, not the message). */
  isComposing: boolean;
}

/** Enter submits; Shift+Enter inserts a newline; IME composition never submits. */
export function shouldSubmit(event: SubmitKeyEvent): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
