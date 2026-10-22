"use client";

import {
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { formProgress } from "../auth-illustration/model.js";
import { useOptionalAuth } from "../internal/auth-context.js";
import {
  type LoginField,
  type LoginFormAppearance,
  LoginFormContext,
  type LoginFormContextValue,
  type LoginFormPart,
  type LoginPortal,
} from "./context.js";
import {
  LoginFormError,
  LoginFormFooter,
  LoginFormHeader,
  LoginFormIdentifier,
  LoginFormOptions,
  LoginFormPassword,
  LoginFormPortals,
  LoginFormProviders,
  LoginFormSubmit,
} from "./parts.js";

export type { LoginFormAppearance, LoginFormPart, LoginPortal } from "./context.js";

export interface LoginValues {
  identifier: string;
  password: string;
  /** Value of the selected portal; `undefined` when the form has none. */
  portal: string | undefined;
  /** State of `LoginForm.Options`' remember-me checkbox. */
  remember: boolean;
}

const MAX_ILLUSTRATED_PORTALS = 3;

export interface LoginFormProps
  extends Omit<ComponentPropsWithoutRef<"form">, "onSubmit" | "children"> {
  /**
   * Called with the values when the form is submitted with both fields filled. A returned promise
   * keeps the form loading; if it resolves the form reads as signed in, if it rejects the message of
   * the error (or the localized default) is shown. Leave it out and drive `loading`, `error` and
   * `success` yourself.
   */
  onSubmit?: (values: LoginValues) => void | Promise<void>;
  /** Portals the person can sign in through. With two or more, `LoginForm.Portals` renders a picker. */
  portals?: readonly LoginPortal[];
  /** Selected portal value. Controlled; omit it for an uncontrolled picker. */
  portal?: string;
  defaultPortal?: string;
  onPortalChange?: (value: string) => void;
  /**
   * `card` is the form inside the panel card, labels hidden visually. `open` has no card chrome and
   * shows the labels above the fields with a pill button. Defaults to `open` inside an
   * `AuthLayout panel="solid"` and `card` otherwise.
   */
  appearance?: LoginFormAppearance;
  /** The form is waiting for the server. Overrides the state `onSubmit` keeps. */
  loading?: boolean;
  /** Sign-in error to show. `null` clears it. Overrides the state `onSubmit` keeps. */
  error?: string | null;
  /** The sign-in worked. Overrides the state `onSubmit` keeps. */
  success?: boolean;
  /**
   * Parts to place yourself: `LoginForm.Header`, `.Portals`, `.Error`, `.Identifier`, `.Password`,
   * `.Options`, `.Submit`, `.Providers` and `.Footer`. Without children the form renders them in that
   * order (no `.Options`, `.Providers` or `.Footer`). A field left empty is reported under that field;
   * `.Error` shows only errors about the sign-in itself, so place it above the fields.
   */
  children?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<LoginFormPart>;
}

/**
 * Sign-in form that works alone and, inside an `AuthLayout`, drives its illustration: focusing the
 * identifier or the password, typing, failing and signing in all update the layout's state and
 * progress, and the selected portal becomes the illustration's active slab.
 */
export function LoginForm({
  onSubmit,
  portals = [],
  portal: portalProp,
  appearance: appearanceProp,
  defaultPortal,
  onPortalChange,
  loading: loadingProp,
  error: errorProp,
  success: successProp,
  children,
  className,
  classNames,
  onFocus,
  onBlur,
  ...props
}: LoginFormProps) {
  const strings = useUiStrings();
  const auth = useOptionalAuth();
  const baseId = useId();
  const identifierRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [internal, setInternal] = useState<{
    loading: boolean;
    error: string | null;
    success: boolean;
    field: LoginField | null;
    /** The error is about a field left empty, not about the sign-in. */
    fieldError?: boolean;
  }>({ loading: false, error: null, success: false, field: null });
  const [portalValue, setPortalValue] = useControllableState<string>({
    prop: portalProp,
    defaultProp: defaultPortal ?? portals[0]?.value ?? "",
    onChange: onPortalChange,
  });

  const appearance = appearanceProp ?? (auth?.panel === "solid" ? "open" : "card");
  const loading = loadingProp ?? internal.loading;
  const error = errorProp !== undefined ? errorProp : internal.error;
  const success = successProp ?? internal.success;
  const portalIndex = Math.max(
    0,
    portals.findIndex((option) => option.value === portalValue),
  );
  const portal = portals[portalIndex];
  const invalidField = error ? (internal.field ?? "password") : null;
  const errorPlacement =
    error === null || error === undefined || error === ""
      ? null
      : errorProp === undefined && internal.fieldError
        ? "field"
        : "form";

  const focusedField = useRef<LoginField | null>(null);
  const leftOutcome = useRef(false);
  const setAuthState = auth?.setState;
  const setAuthProgress = auth?.setProgress;
  const setAuthActive = auth?.setActiveIndex;
  const progress = formProgress(identifier.length, password.length > 0);

  useEffect(() => {
    setAuthProgress?.(progress);
  }, [progress, setAuthProgress]);
  const hasPortal = portal !== undefined;
  useEffect(() => {
    if (hasPortal) setAuthActive?.(Math.min(portalIndex, MAX_ILLUSTRATED_PORTALS - 1));
  }, [hasPortal, portalIndex, setAuthActive]);
  useEffect(() => {
    if (success) {
      leftOutcome.current = true;
      setAuthState?.("success");
    } else if (error) {
      leftOutcome.current = true;
      setAuthState?.("error");
    } else if (leftOutcome.current) {
      // The outcome went away (a controlled flag reset, or a new submit started): read focus again.
      leftOutcome.current = false;
      const field = focusedField.current;
      setAuthState?.(field === "identifier" ? "typing" : field || loading ? "password" : "idle");
    }
  }, [success, error, loading, setAuthState]);

  const context = useMemo<LoginFormContextValue>(
    () => ({
      ids: {
        identifier: `${baseId}-identifier`,
        password: `${baseId}-password`,
        error: `${baseId}-error`,
        fieldError: `${baseId}-field-error`,
        portals: `${baseId}-portals`,
      },
      portals,
      portal,
      setPortal: setPortalValue,
      identifier,
      password,
      appearance,
      remember,
      setRemember,
      loading,
      error,
      invalidField,
      errorPlacement,
      setValue: (field, value) => {
        if (field === "identifier") setIdentifier(value);
        else setPassword(value);
        if (internal.error || internal.field) {
          setInternal((current) => ({ ...current, error: null, field: null }));
        }
        setAuthState?.(field === "identifier" ? "typing" : "password");
      },
      identifierRef,
      passwordRef,
      classNames,
    }),
    [
      baseId,
      portals,
      portal,
      setPortalValue,
      identifier,
      password,
      appearance,
      remember,
      loading,
      error,
      invalidField,
      errorPlacement,
      internal.error,
      internal.field,
      classNames,
      setAuthState,
    ],
  );

  const fieldOf = (target: EventTarget): LoginField | null =>
    target === identifierRef.current
      ? "identifier"
      : target === passwordRef.current
        ? "password"
        : null;

  const handleFocus = (event: FocusEvent<HTMLFormElement>) => {
    onFocus?.(event);
    const field = fieldOf(event.target);
    if (field) focusedField.current = field;
    if (field && !loading && !success && !error) {
      setAuthState?.(field === "identifier" ? "typing" : "password");
    }
  };
  const handleBlur = (event: FocusEvent<HTMLFormElement>) => {
    onBlur?.(event);
    if (!fieldOf(event.target)) return;
    const next = event.relatedTarget;
    const staying = next !== null && fieldOf(next) !== null;
    if (!staying) focusedField.current = null;
    if (!staying && !loading && !success && !error) setAuthState?.("idle");
  };

  const fail = (message: string, field: LoginField, fieldError = false) => {
    setInternal({ loading: false, error: message, success: false, field, fieldError });
    (field === "identifier" ? identifierRef : passwordRef).current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    if (!identifier.trim()) return fail(strings.enterIdentifier, "identifier", true);
    if (!password) return fail(strings.enterPassword, "password", true);
    const values: LoginValues = {
      identifier: identifier.trim(),
      password,
      portal: portal?.value,
      remember,
    };
    setInternal({ loading: true, error: null, success: false, field: null });
    try {
      await onSubmit?.(values);
      setInternal({ loading: false, error: null, success: onSubmit !== undefined, field: null });
    } catch (cause) {
      fail(
        cause instanceof Error && cause.message ? cause.message : strings.signInFailed,
        "password",
      );
    }
  };

  return (
    <LoginFormContext value={context}>
      <form
        method="post"
        noValidate
        {...props}
        aria-busy={loading || undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmit={handleSubmit}
        data-appearance={appearance}
        className={cn(
          "grid",
          appearance === "open"
            ? "mx-auto w-full max-w-110 gap-5"
            : "gap-3.5 px-7 pt-6.5 pb-5.5 @max-md/auth:px-1 @max-md/auth:pt-4",
          appearance === "open" && auth?.panel === "paper" && "px-7 pt-7.5 pb-6",
          classNames?.root,
          className,
        )}
      >
        {children ?? (
          <>
            <LoginFormHeader />
            <LoginFormPortals />
            <LoginFormError />
            <LoginFormIdentifier />
            <LoginFormPassword />
            <LoginFormSubmit />
          </>
        )}
      </form>
    </LoginFormContext>
  );
}

LoginForm.Header = LoginFormHeader;
LoginForm.Portals = LoginFormPortals;
LoginForm.Identifier = LoginFormIdentifier;
LoginForm.Password = LoginFormPassword;
LoginForm.Options = LoginFormOptions;
LoginForm.Providers = LoginFormProviders;
LoginForm.Error = LoginFormError;
LoginForm.Submit = LoginFormSubmit;
LoginForm.Footer = LoginFormFooter;
