"use client";

import {
  AuthIllustration,
  type AuthIllustrationProps,
} from "../auth-illustration/auth-illustration.js";
import type { AuthLook } from "../auth-illustration/look.js";
import { Character } from "../character/character.js";
import { Mosaic } from "../mosaic/mosaic.js";
import { Slabs } from "../slabs/slabs.js";
import { Stack } from "../stack/stack.js";
import { Statement } from "../statement/statement.js";

export type AuthIllustrationVariant = "slabs" | "stack" | "mosaic" | "character" | "statement";

/** The five looks by name. Importing this module keeps all of them in the bundle. */
export const AUTH_LOOKS: Readonly<Record<AuthIllustrationVariant, AuthLook>> = {
  slabs: Slabs,
  stack: Stack,
  mosaic: Mosaic,
  character: Character,
  statement: Statement,
};

export interface AuthIllustrationAnyProps extends Omit<AuthIllustrationProps, "look"> {
  /** The look by name. Defaults to `slabs`. */
  variant?: AuthIllustrationVariant;
}

/**
 * `AuthIllustration` with the look chosen by a string. It imports all five looks on purpose, so an
 * app that renders it pays for every look in its bundle (about 2 to 3 KB gzip each). Apps that use
 * one look should pass it to `AuthIllustration` from its own entry, for example
 * `@jcsoftdev/ui/auth/stack`.
 */
export function AuthIllustrationAny({ variant = "slabs", ...props }: AuthIllustrationAnyProps) {
  return <AuthIllustration {...props} look={AUTH_LOOKS[variant]} />;
}
