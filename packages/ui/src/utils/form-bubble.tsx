"use client";

import { type MouseEvent, useEffect, useReducer, useRef, useState } from "react";

/**
 * Native form participation for custom toggles. The visible control is a
 * button; a visually hidden input mirrors its state so FormData, `required`
 * validation, `form` association and form-level change listeners keep working.
 */
export function useFormBubble(form?: string) {
  const [control, setControl] = useState<HTMLElement | null>(null);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const stoppedRef = useRef(false);
  const [interactions, markInteraction] = useReducer((count: number) => count + 1, 0);
  // Defaults to true before mount so the input also exists in server markup.
  const isFormControl = control ? !!form || !!control.closest("form") : true;

  function onControlClick(event: MouseEvent, interacted = true) {
    if (interacted) markInteraction();
    if (input && isFormControl) {
      stoppedRef.current = event.isPropagationStopped();
      // The hidden input re-dispatches the click, so stop the button's own copy.
      if (!stoppedRef.current) event.stopPropagation();
    }
  }

  return {
    control,
    setControl,
    input,
    setInput,
    stoppedRef,
    interactions,
    isFormControl,
    onControlClick,
  };
}

export type FormBubble = ReturnType<typeof useFormBubble>;

/** Runs `onReset` when the associated form resets. */
export function useFormReset(
  control: HTMLElement | null,
  form: string | undefined,
  onReset: () => void,
) {
  const resetRef = useRef(onReset);
  useEffect(() => {
    resetRef.current = onReset;
  });
  useEffect(() => {
    if (!control) return;
    const owner = form ? control.ownerDocument.getElementById(form) : control.closest("form");
    if (!(owner instanceof HTMLFormElement)) return;
    const reset = () => resetRef.current();
    owner.addEventListener("reset", reset);
    return () => owner.removeEventListener("reset", reset);
  }, [control, form]);
}

function useControlSize(control: HTMLElement | null) {
  const [size, setSize] = useState<{ width: number; height: number } | undefined>();
  useEffect(() => {
    if (!control) return setSize(undefined);
    const update = () => setSize({ width: control.offsetWidth, height: control.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(control, { box: "border-box" });
    return () => observer.disconnect();
  }, [control]);
  return size;
}

export interface BubbleInputProps {
  type: "checkbox" | "radio";
  checked: boolean | "indeterminate";
  bubble: FormBubble;
  name?: string | undefined;
  value?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  form?: string | undefined;
}

export function BubbleInput({
  type,
  checked,
  bubble,
  name,
  value,
  required,
  disabled,
  form,
}: BubbleInputProps) {
  const { control, input, setInput, stoppedRef, interactions } = bubble;
  const size = useControlSize(control);
  const stopClickRef = useRef(false);
  const prevCheckedRef = useRef(checked);
  const prevInteractionsRef = useRef(interactions);
  const initialRef = useRef(checked === true);

  useEffect(() => {
    if (!input) return;
    const isUserInteraction = interactions !== prevInteractionsRef.current;
    prevInteractionsRef.current = interactions;
    const changed = prevCheckedRef.current !== checked;
    prevCheckedRef.current = checked;
    if (!changed) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "checked",
    )?.set;
    if (!setter) return;
    const bubbles = !(isUserInteraction && stoppedRef.current);
    stopClickRef.current = !isUserInteraction;
    input.indeterminate = checked === "indeterminate";
    setter.call(input, checked === true);
    input.dispatchEvent(new Event("click", { bubbles }));
    stopClickRef.current = false;
  }, [input, checked, interactions, stoppedRef]);

  return (
    <input
      type={type}
      aria-hidden
      defaultChecked={initialRef.current}
      required={required}
      disabled={disabled}
      name={name}
      value={value}
      form={form}
      tabIndex={-1}
      ref={setInput}
      onClick={(event) => {
        if (stopClickRef.current) event.stopPropagation();
      }}
      style={{
        ...size,
        position: "absolute",
        pointerEvents: "none",
        opacity: 0,
        margin: 0,
        transform: "translateX(-100%)",
      }}
    />
  );
}
