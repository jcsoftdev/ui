"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button, type ButtonProps } from "../../atoms/button/button.js";
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
  const { portal, classNames } = useLoginForm("Header");
  const text = description ?? portal?.description;
  return (
    <div {...props} className={cn("grid gap-1.5", classNames?.header, className)}>
      <Title
        className={cn("m-0 text-center font-extrabold text-3xl tracking-tight", classNames?.title)}
      >
        {title ?? strings.signIn}
      </Title>
      {text ? (
        <p
          className={cn(
            "m-0 text-balance text-center text-ink-3 text-control",
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
  const { portals, portal, setPortal, ids, classNames } = useLoginForm("Portals");
  if (portals.length < 2) return null;
  return (
    <div className="grid gap-2.5">
      <div id={ids.portals} className="text-center font-semibold text-ink text-control">
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

// A fragment keeps Field from cloning its own (empty) aria props over the form-level error wiring.
const fieldClasses = "[&_input]:text-fs-140";

export function LoginFormIdentifier({ label, placeholder, className }: LoginFormFieldProps) {
  const strings = useUiStrings();
  const { ids, portal, identifier, setValue, invalidField, identifierRef, classNames } =
    useLoginForm("Identifier");
  const text = label ?? portal?.identifierLabel ?? strings.identifier;
  return (
    <Field
      label={text}
      controlId={ids.identifier}
      classNames={{ label: "sr-only" }}
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
          placeholder={placeholder ?? text}
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
  const { ids, password, setValue, invalidField, passwordRef, classNames } =
    useLoginForm("Password");
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
        classNames={{ label: "sr-only" }}
        className={cn(fieldClasses, classNames?.password, className)}
      >
        {/* biome-ignore lint/complexity/noUselessFragments: stops Field cloning empty aria props over the error wiring */}
        <>
          <PasswordInput
            ref={passwordRef}
            id={ids.password}
            name="password"
            size="lg"
            placeholder={placeholder ?? text}
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
        "m-0 min-h-4.5 font-semibold text-danger text-meta",
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
  const { loading, classNames } = useLoginForm("Submit");
  return (
    <Button
      variant="primary"
      size="lg"
      block
      {...props}
      type="submit"
      loading={loading}
      className={cn(classNames?.submit, className)}
    >
      {children ?? strings.signInAction}
    </Button>
  );
}

export interface LoginFormFooterProps extends ComponentPropsWithoutRef<"div"> {}

/** Strip under the form for terms and privacy links; it runs edge to edge of the card. */
export function LoginFormFooter({ className, ...props }: LoginFormFooterProps) {
  const { classNames } = useLoginForm("Footer");
  return (
    <div
      {...props}
      className={cn(
        "-mx-7 -mb-5.5 mt-1 border-t-divider px-5 py-3.5 text-center text-ink-3 text-meta [&_a]:text-inherit [&_a]:underline [&_a]:underline-offset-2",
        classNames?.footer,
        className,
      )}
    />
  );
}

export { Lock as LoginFormLockIcon };
