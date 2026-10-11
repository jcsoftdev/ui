import { useCallback, useEffect, useRef, useState } from "react";

export interface ControllableStateOptions<T> {
  /** Controlled value. `undefined` means uncontrolled. */
  prop: T | undefined;
  defaultProp: T;
  onChange?: ((value: T) => void) | undefined;
}

type Updater<T> = T | ((prev: T) => T);

/**
 * Controlled/uncontrolled state. `onChange` fires only when the value really
 * changes, for both modes; a controlled owner stays the source of truth.
 */
export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: ControllableStateOptions<T>): [T, (next: Updater<T>) => void] {
  const [uncontrolled, setUncontrolled] = useState<T>(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolled;

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const setValue = useCallback(
    (next: Updater<T>) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
      if (Object.is(resolved, valueRef.current)) return;
      if (!isControlled) {
        valueRef.current = resolved;
        setUncontrolled(resolved);
      }
      onChangeRef.current?.(resolved);
    },
    [isControlled],
  );

  return [value, setValue];
}
