import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect } from "storybook/test";
import { AuthIllustration } from "../auth-illustration/auth-illustration.js";
import type { AuthLook } from "../auth-illustration/look.js";
import { AUTH_STATES, type AuthState } from "../auth-illustration/model.js";
import { Character } from "../character/character.js";
import { AuthContext, type AuthContextValue, type AuthPanel } from "../internal/auth-context.js";
import { Mosaic } from "../mosaic/mosaic.js";
import { Stack } from "../stack/stack.js";
import { Statement } from "../statement/statement.js";
import { AuthIllustrationAny } from "./auth-illustration-any.js";

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
  look: AuthLook;
  panel?: AuthPanel;
  widths?: readonly number[];
  states?: readonly AuthState[];
  headline?: string;
  caption?: string;
}

/** Every state at each container width: the art adapts to the width it is given. */
function Grid({
  look,
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
                    look={look}
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
    look: { control: false },
    panel: { control: "inline-radio", options: ["paper", "solid"] },
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StackStates: Story = { args: { look: Stack } };

export const StackSolid: Story = { args: { look: Stack, panel: "solid" } };

/** Narrow art containers show a shorter tower. */
export const StackNarrow: Story = {
  args: { look: Stack, widths: [240, 460, 640], states: ["password"] },
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

export const MosaicStates: Story = { args: { look: Mosaic } };

export const MosaicSolid: Story = { args: { look: Mosaic, panel: "solid" } };

/** The floor has 4, 5 or 6 tiles a side by the width of its container. */
export const MosaicNarrow: Story = {
  args: { look: Mosaic, widths: [240, 460, 640], states: ["typing"] },
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

export const CharacterStates: Story = { args: { look: Character, panel: "solid" } };

export const CharacterPaper: Story = { args: { look: Character } };

/** Clouds drift around the rider only when the container has room for them. */
export const CharacterNarrow: Story = {
  args: { look: Character, panel: "solid", widths: [240, 460], states: ["password"] },
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
  look: Statement,
  headline: "Every class, every family, one place.",
  caption: "Sign in to pick up where your school left off.",
} as const;

/** Assistive technology follows what is visible: the headline until success, then "You're in." */
export const StatementStates: Story = {
  args: STATEMENT,
  play: async ({ canvasElement }) => {
    const arts = [
      ...canvasElement.querySelectorAll<HTMLElement>(".ui-auth-art[data-variant=statement]"),
    ];
    await expect(arts.length).toBeGreaterThan(0);
    for (const art of arts) {
      const signedIn = art.dataset.state === "success";
      const main = art.querySelector("[data-line=main]") as Element;
      const done = art.querySelector("[data-line=done]") as Element;
      const caption = art.querySelector(".ui-stm-caption") as HTMLElement;
      await expect(main.getAttribute("aria-hidden") === "true").toBe(signedIn);
      await expect(done.getAttribute("aria-hidden") === "true").toBe(!signedIn);
      await expect(caption.getAttribute("aria-hidden") === "true").toBe(signedIn);
      await expect(getComputedStyle(caption).visibility).toBe(signedIn ? "hidden" : "visible");
    }
  },
};

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

/** The string convenience: `AuthIllustrationAny` resolves the look by name and keeps `data-variant`. */
export const ByName: Story = {
  args: { look: Stack },
  render: () => (
    <div className="grid gap-4 p-4">
      {(["slabs", "stack", "mosaic", "character", "statement"] as const).map((variant) => (
        <AuthIllustrationAny key={variant} variant={variant} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const names = [...canvasElement.querySelectorAll(".ui-auth-art")].map((art) =>
      art.getAttribute("data-variant"),
    );
    await expect(names).toEqual(["slabs", "stack", "mosaic", "character", "statement"]);
  },
};
