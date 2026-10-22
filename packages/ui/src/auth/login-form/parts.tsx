"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button, type ButtonProps } from "../../atoms/button/button.js";
import { Checkbox } from "../../atoms/checkbox/checkbox.js";
import { Divider } from "../../atoms/divider/divider.js";
import { RadioGroupItem, RadioGroupRoot } from "../../atoms/radio-group/radio-group-primitive.js";
import { Field } from "../../forms/field/field.js";
import { Input } from "../../forms/input/input.js";
import { PasswordInput } from "../../forms/password-input/password-input.js";
import { useUiStrings } from "../../i18n/index.js";
import { BookOpen, GraduationCap, House, Lock, Mail } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { type LoginPortal, useLoginForm } from "./context.js";

const FALLBACK_ICONS = [
  <BookOpen key="book" />,
  <House key="house" />,
  <GraduationCap key="cap" />,
];

export interface LoginFormHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Defaults to the localized "Sign in". */
  title?: ReactNode;
  /** Defaults to the description of the selected portal. */
  description?: ReactNode;
  /** Heading element of the title. Defaults to `h1`: the form is the point of the page. */
  titleAs?: "h1" | "h2" | "h3";
}

export function LoginFormHeader({
  title,
  description,
  titleAs: Title = "h1",
  className,
  ...props
}: LoginFormHeaderProps) {
  const strings = useUiStrings();
  const { portal, appearance, classNames } = useLoginForm("Header");
  const open = appearance === "open";
  const text = description ?? portal?.description;
  return (
    <div {...props} className={cn("grid gap-1.5", classNames?.header, className)}>
      <Title
        className={cn(
          "m-0 font-extrabold tracking-tight",
          open ? "text-4xl" : "text-center text-3xl",
          classNames?.title,
        )}
      >
        {title ?? strings.signIn}
      </Title>
      {text ? (
        <p
          className={cn(
            "m-0 text-balance text-ink-3 text-control",
            !open && "text-center",
            classNames?.description,
          )}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

export interface LoginFormPortalsProps {
  /** Visible heading of the picker. Defaults to the localized "Sign in as". */
  label?: string;
  className?: string;
}

/**
 * Picker of the portal the person signs in through: a radio group of icon tiles with arrow-key
 * navigation. Renders nothing when the form has fewer than two portals.
 */
export function LoginFormPortals({ label, className }: LoginFormPortalsProps) {
  const strings = useUiStrings();
  const { portals, portal, setPortal, ids, appearance, classNames } = useLoginForm("Portals");
  if (portals.length < 2) return null;
  return (
    <div className="grid gap-2.5">
      <div
        id={ids.portals}
        className={cn(
          "font-semibold text-ink text-control",
          appearance === "card" && "text-center",
        )}
      >
        {label ?? strings.signInAs}
      </div>
      <RadioGroupRoot
        aria-labelledby={ids.portals}
        value={portal?.value ?? ""}
        onValueChange={setPortal}
        orientation="horizontal"
        className={cn("grid gap-2.5", classNames?.portals, className)}
        style={{ gridTemplateColumns: `repeat(${portals.length}, minmax(0, 1fr))` }}
      >
        {portals.map((option: LoginPortal, index) => (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              "group grid cursor-pointer justify-items-center gap-1.5 rounded-input bg-transparent p-0 font-medium text-control text-ink focus-visible:focus-ring",
              classNames?.portal,
            )}
          >
            <span
              aria-hidden="true"
              className="grid h-13 w-16 place-items-center rounded-input border-[1.5px] border-line-strong bg-surface text-ink transition-[border-color,background-color,transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-data-[state=checked]:border-ink group-data-[state=checked]:bg-surface-2 group-data-[state=checked]:shadow-[0_2px_0_var(--ink)] [&>svg]:size-6"
            >
              {option.icon ?? FALLBACK_ICONS[index]}
            </span>
            {option.label}
          </RadioGroupItem>
        ))}
      </RadioGroupRoot>
      <Divider className="mt-1.5">{strings.withYourAccount}</Divider>
    </div>
  );
}

export interface LoginFormFieldProps {
  /** Visible label. The default design hides it visually and keeps it for assistive technology. */
  label?: string;
  placeholder?: string;
  className?: string;
}

const fieldClasses = "[&_input]:text-fs-140";

export function LoginFormIdentifier({ label, placeholder, className }: LoginFormFieldProps) {
  const strings = useUiStrings();
  const { ids, portal, identifier, setValue, invalidField, identifierRef, appearance, classNames } =
    useLoginForm("Identifier");
  const hideLabel = appearance === "card";
  const text = label ?? portal?.identifierLabel ?? strings.identifier;
  return (
    <Field
      label={text}
      controlId={ids.identifier}
      classNames={{ label: hideLabel ? "sr-only" : "" }}
      className={cn(fieldClasses, classNames?.identifier, className)}
    >
      {/* biome-ignore lint/complexity/noUselessFragments: stops Field cloning empty aria props over the error wiring */}
      <>
        <Input
          ref={identifierRef}
          id={ids.identifier}
          name="identifier"
          size="lg"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder ?? (hideLabel ? text : undefined)}
          value={identifier}
          onChange={(event) => setValue("identifier", event.currentTarget.value)}
          start={<Mail />}
          aria-invalid={invalidField === "identifier" ? true : undefined}
          aria-describedby={invalidField === "identifier" ? ids.error : undefined}
        />
      </>
    </Field>
  );
}

export interface LoginFormPasswordProps extends LoginFormFieldProps {
  /** Adds a "Forgot your password?" link to this address. */
  forgotHref?: string;
  /** Replaces the forgot link with any node (a router link, a button). */
  forgot?: ReactNode;
}

export function LoginFormPassword({
  label,
  placeholder,
  forgotHref,
  forgot,
  className,
}: LoginFormPasswordProps) {
  const strings = useUiStrings();
  const { ids, password, setValue, invalidField, passwordRef, appearance, classNames } =
    useLoginForm("Password");
  const hideLabel = appearance === "card";
  const text = label ?? strings.password;
  const link =
    forgot ??
    (forgotHref ? (
      <a
        href={forgotHref}
        className="font-medium text-accent-ink text-control underline underline-offset-3 focus-visible:focus-ring"
      >
        {strings.forgotPassword}
      </a>
    ) : null);
  return (
    <div className="grid gap-2">
      <Field
        label={text}
        controlId={ids.password}
        classNames={{ label: hideLabel ? "sr-only" : "" }}
        className={cn(fieldClasses, classNames?.password, className)}
      >
        {/* biome-ignore lint/complexity/noUselessFragments: stops Field cloning empty aria props over the error wiring */}
        <>
          <PasswordInput
            ref={passwordRef}
            id={ids.password}
            name="password"
            size="lg"
            start={<Lock />}
            placeholder={placeholder ?? (hideLabel ? text : undefined)}
            value={password}
            onChange={(event) => setValue("password", event.currentTarget.value)}
            aria-invalid={invalidField === "password" ? true : undefined}
            aria-describedby={invalidField === "password" ? ids.error : undefined}
          />
        </>
      </Field>
      {link ? <div className="justify-self-end">{link}</div> : null}
    </div>
  );
}

export interface LoginFormErrorProps extends Omit<ComponentPropsWithoutRef<"p">, "children"> {}

/** Live region for the sign-in error. It stays in the page while empty so the message is announced. */
export function LoginFormError({ className, ...props }: LoginFormErrorProps) {
  const { ids, error, classNames } = useLoginForm("Error");
  return (
    <p
      {...props}
      id={ids.error}
      role="alert"
      className={cn(
        "m-0 min-h-4.5 font-semibold text-danger text-meta empty:absolute",
        classNames?.error,
        className,
      )}
    >
      {error}
    </p>
  );
}

export interface LoginFormSubmitProps extends Omit<ButtonProps, "type" | "loading"> {}

export function LoginFormSubmit({ children, className, ...props }: LoginFormSubmitProps) {
  const strings = useUiStrings();
  const { loading, appearance, classNames } = useLoginForm("Submit");
  return (
    <Button
      variant="primary"
      size="lg"
      block
      {...props}
      type="submit"
      loading={loading}
      className={cn(appearance === "open" && "rounded-pill", classNames?.submit, className)}
    >
      {children ?? strings.signInAction}
    </Button>
  );
}

export interface LoginFormFooterProps extends ComponentPropsWithoutRef<"div"> {}

/** Terms and privacy links under the form. In the card appearance it is a strip running edge to edge. */
export function LoginFormFooter({ className, ...props }: LoginFormFooterProps) {
  const { appearance, classNames } = useLoginForm("Footer");
  return (
    <div
      {...props}
      className={cn(
        "text-ink-3 text-meta [&_a]:text-inherit [&_a]:underline [&_a]:underline-offset-2",
        appearance === "card"
          ? "-mx-7 -mb-5.5 mt-1 border-t-divider px-5 py-3.5 text-center"
          : "text-center",
        classNames?.footer,
        className,
      )}
    />
  );
}

export { Lock as LoginFormLockIcon };

export interface LoginFormOptionsProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Label of the checkbox. Defaults to the localized "Remember me". */
  rememberLabel?: string;
  /** Help link or button at the end of the row. */
  help?: ReactNode;
  /** Adds the localized "Need help?" link to this address when `help` is not given. */
  helpHref?: string;
}

/** Row under the fields with a remember-me checkbox (reported to `onSubmit` as `remember`) and a help slot. */
export function LoginFormOptions({
  rememberLabel,
  help,
  helpHref,
  className,
  ...props
}: LoginFormOptionsProps) {
  const strings = useUiStrings();
  const { remember, setRemember, classNames } = useLoginForm("Options");
  const link =
    help ??
    (helpHref ? (
      <a
        href={helpHref}
        className="font-medium text-accent-ink text-control underline underline-offset-3 focus-visible:focus-ring"
      >
        {strings.needHelp}
      </a>
    ) : null);
  return (
    <div
      {...props}
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        classNames?.options,
        className,
      )}
    >
      <Checkbox
        name="remember"
        checked={remember}
        onCheckedChange={(checked) => setRemember(checked === true)}
        label={rememberLabel ?? strings.rememberMe}
        classNames={{ wrapper: "-ml-2.75" }}
      />
      {link}
    </div>
  );
}

export interface LoginFormProvidersProps extends ComponentPropsWithoutRef<"div"> {
  /** Text on the divider above the providers. Defaults to the localized "Or log in with". */
  label?: string;
}

/**
 * Labelled slot for alternative ways to sign in. The library ships no providers: it renders only
 * the children you pass (buttons, links) in a wrapping row, and nothing when there are none.
 */
export function LoginFormProviders({
  label,
  children,
  className,
  ...props
}: LoginFormProvidersProps) {
  const strings = useUiStrings();
  const { classNames } = useLoginForm("Providers");
  if (children === undefined || children === null || children === false) return null;
  const text = label ?? strings.orLogInWith;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a legend and form-disabling behaviour the slot does not want
    <div
      {...props}
      role="group"
      aria-label={text}
      className={cn("grid gap-3", classNames?.providers, className)}
    >
      <Divider>{text}</Divider>
      <div className="flex flex-wrap items-center justify-center gap-2.5">{children}</div>
    </div>
  );
}
