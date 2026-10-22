"use client";

import { createContext, type ReactNode, type RefObject, useContext } from "react";
import type { ClassNames } from "../../utils/class-names.js";

export interface LoginPortal {
  /** Value reported to `onSubmit` and the form's `portal` field. */
  value: string;
  label: string;
  /** Line under the title while this portal is selected. */
  description?: string;
  /** Label and placeholder of the identifier field while this portal is selected. */
  identifierLabel?: string;
  /** Icon of the tile; the first three portals fall back to a book, a house and a cap. */
  icon?: ReactNode;
}

export type LoginFormPart =
  | "root"
  | "header"
  | "title"
  | "description"
  | "portals"
  | "portal"
  | "identifier"
  | "password"
  | "error"
  | "submit"
  | "footer";

export type LoginField = "identifier" | "password";

export interface LoginFormContextValue {
  ids: { identifier: string; password: string; error: string; portals: string };
  portals: readonly LoginPortal[];
  portal: LoginPortal | undefined;
  setPortal: (value: string) => void;
  identifier: string;
  password: string;
  loading: boolean;
  error: string | null;
  /** The field the current error belongs to, so it can be marked invalid. */
  invalidField: LoginField | null;
  setValue: (field: LoginField, value: string) => void;
  identifierRef: RefObject<HTMLInputElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  classNames: ClassNames<LoginFormPart> | undefined;
}

export const LoginFormContext = createContext<LoginFormContextValue | null>(null);

export function useLoginForm(part: string): LoginFormContextValue {
  const context = useContext(LoginFormContext);
  if (!context) throw new Error(`LoginForm.${part} must be rendered inside a LoginForm`);
  return context;
}
