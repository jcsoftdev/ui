import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect } from "storybook/test";
import { AuthContext, type AuthContextValue, type AuthPanel } from "../internal/auth-context.js";
import { AuthIllustration } from "./auth-illustration.js";
import { AUTH_STATES, type AuthState } from "./model.js";
import type { AuthIllustrationVariant } from "./variants/index.js";

const noop = () => {};

const PROGRESS: Record<AuthState, number> = {
  idle: 0,
  typing: 0.3,
  password: 0.8,
  error: 0.7,
  success: 1,
};

const SOLID = {
  background: "var(--accent)",
  "--auth-art-bg": "var(--accent)",
  "--auth-art-ink": "var(--on-accent)",
} as CSSProperties;

/** The same context `AuthLayout` provides, so a bare illustration can show its solid-panel look. */
function Panel({ panel, children }: { panel: AuthPanel; children: React.ReactNode }) {
  const value: AuthContextValue = {
    panel,
    state: "idle",
    setState: noop,
    progress: 0,
    setProgress: noop,
    activeIndex: 0,
    setActiveIndex: noop,
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

interface GridProps {
  variant: AuthIllustrationVariant;
  panel?: AuthPanel;
  widths?: readonly number[];
  states?: readonly AuthState[];
  headline?: string;
  caption?: string;
}

/** Every state at each container width: the art adapts to the width it is given. */
function Grid({
  variant,
  panel = "paper",
  widths = [640, 320],
  states = AUTH_STATES,
  headline,
  caption,
}: GridProps) {
  return (
    <Panel panel={panel}>
      <div className="grid gap-6 p-4">
        {states.map((state) => (
          <section key={state} className="grid gap-2">
            <p className="m-0 text-ink-3 text-meta">{state}</p>
            <div className="flex flex-wrap items-end gap-6">
              {widths.map((width) => (
                <div
                  key={width}
                  data-width={width}
                  className="rounded-card p-4"
                  style={{
                    width,
                    ...(panel === "solid"
                      ? SOLID
                      : { background: "color-mix(in srgb, var(--accent) 14%, var(--bg))" }),
                  }}
                >
                  <AuthIllustration
                    variant={variant}
                    state={state}
                    progress={PROGRESS[state]}
                    headline={headline}
                    caption={caption}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}

const meta = {
  title: "Auth/Variants",
  component: Grid,
  parameters: { layout: "fullscreen" },
  argTypes: {
    variant: { control: false },
    panel: { control: "inline-radio", options: ["paper", "solid"] },
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StackStates: Story = { args: { variant: "stack" } };

export const StackSolid: Story = { args: { variant: "stack", panel: "solid" } };

/** Narrow art containers show a shorter tower. */
export const StackNarrow: Story = {
  args: { variant: "stack", widths: [240, 460, 640], states: ["password"] },
  play: async ({ canvasElement }) => {
    const shown = (width: number) =>
      [...canvasElement.querySelectorAll(`[data-width="${width}"] .ui-stk-book`)].filter(
        (book) => getComputedStyle(book).display !== "none",
      ).length;
    await expect(shown(240)).toBe(4);
    await expect(shown(460)).toBe(5);
    await expect(shown(640)).toBe(6);
  },
};

export const MosaicStates: Story = { args: { variant: "mosaic" } };

export const MosaicSolid: Story = { args: { variant: "mosaic", panel: "solid" } };

/** The floor has 4, 5 or 6 tiles a side by the width of its container. */
export const MosaicNarrow: Story = {
  args: { variant: "mosaic", widths: [240, 460, 640], states: ["typing"] },
  play: async ({ canvasElement }) => {
    const side = (width: number) =>
      [...canvasElement.querySelectorAll(`[data-width="${width}"] .ui-msc-grid`)]
        .find((grid) => getComputedStyle(grid).display !== "none")
        ?.getAttribute("data-n");
    await expect(side(240)).toBe("4");
    await expect(side(460)).toBe("5");
    await expect(side(640)).toBe("6");
  },
};

export const CharacterStates: Story = { args: { variant: "character", panel: "solid" } };

export const CharacterPaper: Story = { args: { variant: "character" } };

/** Clouds drift around the rider only when the container has room for them. */
export const CharacterNarrow: Story = {
  args: { variant: "character", panel: "solid", widths: [240, 460], states: ["password"] },
  play: async ({ canvasElement }) => {
    const decor = (width: number) =>
      getComputedStyle(
        canvasElement.querySelector(`[data-width="${width}"] .ui-chr-decor`) as Element,
      ).display;
    await expect(decor(240)).toBe("none");
    await expect(decor(460)).not.toBe("none");
  },
};

const STATEMENT = {
  variant: "statement",
  headline: "Every class, every family, one place.",
  caption: "Sign in to pick up where your school left off.",
} as const;

export const StatementStates: Story = { args: STATEMENT };

export const StatementSolid: Story = { args: { ...STATEMENT, panel: "solid" } };

/** The headline scales with its container and stays readable by assistive technology. */
export const StatementNarrow: Story = {
  args: { ...STATEMENT, widths: [240, 460, 640], states: ["typing"] },
  play: async ({ canvasElement }) => {
    const size = (width: number) =>
      Number.parseFloat(
        getComputedStyle(
          canvasElement.querySelector(`[data-width="${width}"] .ui-stm-lines`) as Element,
        ).fontSize,
      );
    await expect(size(240)).toBeLessThan(size(460));
    await expect(size(460)).toBeLessThan(size(640));
    const art = canvasElement.querySelector(`[data-width="640"] .ui-auth-art`) as Element;
    await expect(art.getAttribute("aria-hidden")).toBeNull();
    await expect(art.textContent).toContain("one place.");
  },
};
