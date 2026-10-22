"use client";

import { IconButton } from "../../atoms/icon-button/icon-button.js";
import { useUiStrings } from "../../i18n/index.js";
import { Eye, EyeOff } from "../../icons/index.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { Input, type InputProps } from "../input/input.js";

export interface PasswordInputProps extends Omit<InputProps, "type" | "end"> {
  /** Whether the password is shown as text. Controlled; omit it for an uncontrolled field. */
  revealed?: boolean;
  /** Initial visibility of an uncontrolled field. Defaults to hidden. */
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Accessible name of the reveal toggle; defaults to the UI string `showPassword`. */
  revealLabel?: string;
}

/**
 * Password field with a reveal toggle at its end. The toggle keeps one name and reports the
 * state through `aria-pressed`, so a screen reader hears "Show password, pressed" rather than a
 * label that flips. Toggling never moves focus out of the field's row and never submits a form.
 */
export function PasswordInput({
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  revealLabel,
  autoComplete = "current-password",
  ...props
}: PasswordInputProps) {
  const strings = useUiStrings();
  const [revealed, setRevealed] = useControllableState({
    prop: revealedProp,
    defaultProp: defaultRevealed,
    onChange: onRevealedChange,
  });
  return (
    <Input
      {...props}
      type={revealed ? "text" : "password"}
      autoComplete={autoComplete}
      end={
        <IconButton
          label={revealLabel ?? strings.showPassword}
          aria-pressed={revealed}
          variant="ghost"
          size="sm"
          className="-mr-1.5"
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff /> : <Eye />}
        </IconButton>
      }
    />
  );
}
