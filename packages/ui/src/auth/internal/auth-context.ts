"use client";

import { createContext, useContext } from "react";
import type { AuthState } from "../auth-illustration/model.js";

export type AuthPanel = "paper" | "solid";

export interface AuthContextValue {
  /** Composition of the screen: the card over paper, or a solid side panel with an open form. */
  panel: AuthPanel;
  state: AuthState;
  setState: (state: AuthState) => void;
  /** Fill of the whole form, 0 to 1. */
  progress: number;
  setProgress: (progress: number) => void;
  /** Index of the portal the user is signing in through; the illustration lifts it. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** The state an `AuthLayout` shares with its illustration and form, or `null` outside one. */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
