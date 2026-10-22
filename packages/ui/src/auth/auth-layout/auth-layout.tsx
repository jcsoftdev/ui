"use client";

import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  createContext,
  useContext,
  useMemo,
} from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { AuthIllustration } from "../auth-illustration/auth-illustration.js";
import type { AuthState } from "../auth-illustration/model.js";
import type { AuthIllustrationVariant } from "../auth-illustration/variants/index.js";
import { AuthContext, type AuthContextValue, type AuthPanel } from "../internal/auth-context.js";
import { AuthStyles } from "../internal/auth-styles.js";

export type AuthLayoutKind = "split" | "split-reverse" | "centered";

export type AuthLayoutPart = "root" | "content" | "brand" | "art" | "panel" | "footer";

interface AuthLayoutParts {
  layout: AuthLayoutKind;
  panel: AuthPanel;
  classNames: ClassNames<AuthLayoutPart> | undefined;
}

const AuthLayoutPartsContext = createContext<AuthLayoutParts | null>(null);

function useAuthLayoutParts(part: string): AuthLayoutParts {
  const parts = useContext(AuthLayoutPartsContext);
  if (!parts) throw new Error(`AuthLayout.${part} must be rendered inside an AuthLayout`);
  return parts;
}

/** State shared by the illustration and the form of an `AuthLayout`. Throws outside one. */
export function useAuthLayout(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuthLayout must be called inside an AuthLayout");
  return auth;
}

export interface AuthLayoutProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * `split` puts the art beside the panel once the layout is 768px wide, `split-reverse` swaps the
   * sides, `centered` centers the panel over a faded illustration. Narrower than that the art
   * stacks above the panel, and under 448px it is dropped. All of it follows the layout's own
   * width, not the viewport's.
   */
  layout?: AuthLayoutKind;
  /**
   * `paper` is the card over a tinted page. `solid` fills one side with a solid color for the art
   * and leaves the form open on the other (no card). It applies to `split` and `split-reverse`;
   * `centered` ignores it. A solid root sets `--auth-art-bg` and `--auth-art-ink` for the art, the
   * brand and the illustration, which carries `data-panel="solid"`.
   */
  panel?: AuthPanel;
  /** What the screen is doing, for the illustration. Controlled; `LoginForm` keeps it current when left alone. */
  state?: AuthState;
  defaultState?: AuthState;
  onStateChange?: (state: AuthState) => void;
  /** Fill of the whole form, 0 to 1. */
  progress?: number;
  defaultProgress?: number;
  onProgressChange?: (progress: number) => void;
  /** Index of the portal in use (0 to 2). */
  activeIndex?: number;
  defaultActiveIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<AuthLayoutPart>;
}

/**
 * Screen for signing in: a brand, an illustration that reacts to the form and the form itself,
 * laid out by the width of the layout. It owns the sign-in state (controlled or not) and shares it
 * with `AuthIllustration` and `LoginForm`, so wiring them is just placing them inside.
 *
 * Parts: `AuthLayout.Brand`, `AuthLayout.Art`, `AuthLayout.Panel` and `AuthLayout.Footer`.
 */
export function AuthLayout({
  layout = "split",
  panel: panelProp = "paper",
  state: stateProp,
  defaultState = "idle",
  onStateChange,
  progress: progressProp,
  defaultProgress = 0,
  onProgressChange,
  activeIndex: activeIndexProp,
  defaultActiveIndex = 0,
  onActiveIndexChange,
  className,
  classNames,
  children,
  ...props
}: AuthLayoutProps) {
  const [state, setState] = useControllableState<AuthState>({
    prop: stateProp,
    defaultProp: defaultState,
    onChange: onStateChange,
  });
  const [progress, setProgress] = useControllableState<number>({
    prop: progressProp,
    defaultProp: defaultProgress,
    onChange: onProgressChange,
  });
  const [activeIndex, setActiveIndex] = useControllableState<number>({
    prop: activeIndexProp,
    defaultProp: defaultActiveIndex,
    onChange: onActiveIndexChange,
  });
  const panel: AuthPanel = layout === "centered" ? "paper" : panelProp;
  const auth = useMemo<AuthContextValue>(
    () => ({ panel, state, setState, progress, setProgress, activeIndex, setActiveIndex }),
    [panel, state, setState, progress, setProgress, activeIndex, setActiveIndex],
  );
  const parts = useMemo(() => ({ layout, panel, classNames }), [layout, panel, classNames]);

  return (
    <AuthContext value={auth}>
      <AuthLayoutPartsContext value={parts}>
        <AuthStyles />
        <div
          {...props}
          style={panel === "solid" ? { ...SOLID_ART_VARS, ...props.style } : props.style}
          data-layout={layout}
          data-panel={panel}
          data-state={state}
          className={cn(
            "@container/auth relative isolate min-h-164 min-w-0 overflow-hidden",
            panel === "solid"
              ? "bg-surface"
              : "rounded-card border-divider bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg))]",
            classNames?.root,
            className,
          )}
        >
          <div
            className={cn(
              "grid min-h-[inherit] grid-cols-1",
              panel === "solid"
                ? "content-start items-stretch @3xl/auth:grid-cols-2 @3xl/auth:content-stretch"
                : [
                    "content-center items-center gap-2 px-4 pt-16 pb-8 @lg/auth:px-8 @3xl/auth:px-14 @3xl/auth:pt-7",
                    layout !== "centered" &&
                      "@3xl/auth:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] @3xl/auth:gap-6",
                  ],
              classNames?.content,
            )}
          >
            {children}
          </div>
        </div>
      </AuthLayoutPartsContext>
    </AuthContext>
  );
}

export interface AuthLayoutBrandProps extends ComponentPropsWithoutRef<"div"> {}

/** Colors of the solid art panel, derived from the theme so every accent and dark mode apply. */
const SOLID_ART_VARS = {
  "--auth-art-bg": "color-mix(in srgb, var(--accent) 78%, var(--ink))",
  "--auth-art-ink": "var(--on-accent)",
} as CSSProperties;

/** Logo or wordmark pinned to the top corner. */
export function AuthLayoutBrand({ className, ...props }: AuthLayoutBrandProps) {
  const { layout, panel, classNames } = useAuthLayoutParts("Brand");
  const onSolid = panel === "solid";
  return (
    <div
      {...props}
      className={cn(
        "absolute top-5.5 left-4 z-[3] font-bold text-lg tracking-tight @lg/auth:left-8 @3xl/auth:left-14",
        !onSolid && "text-ink",
        onSolid && "text-[var(--auth-art-ink)] @max-md/auth:text-ink",
        onSolid && layout === "split-reverse" && "@3xl/auth:text-ink",
        classNames?.brand,
        className,
      )}
    />
  );
}

export interface AuthLayoutArtProps extends ComponentPropsWithoutRef<"div"> {
  /** Look of the default illustration, used when there are no children. */
  variant?: AuthIllustrationVariant;
}

/**
 * Holds the illustration (a default `AuthIllustration` when empty). It hides under 448px of layout
 * width and, in `centered`, sits faded behind the panel.
 */
export function AuthLayoutArt({ variant, className, children, ...props }: AuthLayoutArtProps) {
  const { layout, panel, classNames } = useAuthLayoutParts("Art");
  const solid = panel === "solid";
  return (
    <div
      {...props}
      className={cn(
        "grid min-w-0 place-items-center @max-md/auth:hidden",
        layout === "centered" && "pointer-events-none absolute inset-0 -z-10 px-8 opacity-35",
        layout !== "centered" && !solid && "relative mx-auto w-full max-w-90 @3xl/auth:max-w-160",
        layout !== "centered" &&
          solid &&
          "bg-[var(--auth-art-bg)] px-4 pt-20 pb-10 text-[var(--auth-art-ink)] @lg/auth:px-8 @3xl/auth:px-14 @3xl/auth:py-14",
        layout === "split-reverse" && "@3xl/auth:order-2",
        classNames?.art,
        className,
      )}
    >
      {solid ? (
        <div className="w-full max-w-90 @3xl/auth:max-w-160">
          {children ?? <AuthIllustration variant={variant} />}
        </div>
      ) : (
        (children ?? <AuthIllustration variant={variant} />)
      )}
    </div>
  );
}

export interface AuthLayoutPanelProps extends ComponentPropsWithoutRef<"div"> {}

/** The card that holds the form. */
export function AuthLayoutPanel({ className, ...props }: AuthLayoutPanelProps) {
  const { layout, panel, classNames } = useAuthLayoutParts("Panel");
  return (
    <div
      {...props}
      className={cn(
        panel === "solid"
          ? "relative z-[2] grid min-w-0 content-center px-4 py-10 text-ink @lg/auth:px-8 @3xl/auth:px-14 @3xl/auth:py-14"
          : "ui-auth-rise relative z-[2] w-full max-w-110 min-w-0 justify-self-center overflow-hidden rounded-card border-[1.5px] border-ink bg-surface text-ink shadow-[0_3px_0_var(--ink),0_24px_50px_-12px_color-mix(in_srgb,var(--ink)_18%,transparent)]",
        layout === "split-reverse" && "@3xl/auth:order-1",
        classNames?.panel,
        className,
      )}
    />
  );
}

export interface AuthLayoutFooterProps extends ComponentPropsWithoutRef<"div"> {}

/** Line under the panel, across the full width (terms, support, a language switch). */
export function AuthLayoutFooter({ className, ...props }: AuthLayoutFooterProps) {
  const { panel, classNames } = useAuthLayoutParts("Footer");
  return (
    <div
      {...props}
      className={cn(
        "relative z-[2] col-span-full text-center text-ink-3 text-meta",
        panel === "solid" && "px-4 pb-6",
        classNames?.footer,
        className,
      )}
    />
  );
}

AuthLayout.Brand = AuthLayoutBrand;
AuthLayout.Art = AuthLayoutArt;
AuthLayout.Panel = AuthLayoutPanel;
AuthLayout.Footer = AuthLayoutFooter;
