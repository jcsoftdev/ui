export interface ControllableOptions<T> {
  /** Controlled value. `undefined` means uncontrolled. */
  value?: T | undefined;
  defaultValue: T;
  /** Fires only when the value really changes (`Object.is`), in both modes. */
  onChange?: ((value: T) => void) | undefined;
}

export interface Controllable<T> {
  get(): T;
  /** Requests a change: an uncontrolled store updates, a controlled one only notifies. */
  set(next: T | ((previous: T) => T)): void;
  /** The owner's value; `undefined` hands control back to the store. */
  control(value: T | undefined): void;
  readonly controlled: boolean;
}

/**
 * Controlled/uncontrolled state without a framework: the same contract as the React kit's
 * `useControllableState`. A controlled owner stays the source of truth.
 */
export function createControllable<T>({
  value,
  defaultValue,
  onChange,
}: ControllableOptions<T>): Controllable<T> {
  let own = defaultValue;
  let owner = value;
  const current = () => (owner !== undefined ? owner : own);
  return {
    get: current,
    set(next) {
      const previous = current();
      const resolved = typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      if (Object.is(resolved, previous)) return;
      if (owner === undefined) own = resolved;
      onChange?.(resolved);
    },
    control(next) {
      owner = next;
    },
    get controlled() {
      return owner !== undefined;
    },
  };
}
