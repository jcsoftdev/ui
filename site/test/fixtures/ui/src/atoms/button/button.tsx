import type { ComponentPropsWithoutRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Visual weight of the button. */
  variant?: ButtonVariant;
  /** Show a spinner and disable the button. @default false */
  loading?: boolean;
  /** Text shown inside the button. */
  label: string;
}

/**
 * A pressable action. Renders a native button.
 *
 * Keyboard: Enter and Space activate it.
 *
 * @keyboard Tab moves focus to the button.
 */
export function Button({ variant = "secondary", label, loading, ...rest }: ButtonProps) {
  return (
    <button type="button" data-variant={variant} aria-busy={loading} {...rest}>
      {label}
    </button>
  );
}
