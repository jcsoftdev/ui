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
}

/** Every state at each container width: the art adapts to the width it is given. */
function Grid({ variant, panel = "paper", widths = [640, 320], states = AUTH_STATES }: GridProps) {
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
                  <AuthIllustration variant={variant} state={state} progress={PROGRESS[state]} />
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
