import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Mosaic } from "../mosaic/mosaic.js";
import { AuthIllustration } from "./auth-illustration.js";
import { AUTH_STATES } from "./model.js";

/**
 * Applies every `prefers-reduced-motion: reduce` rule of the page as if the setting were on: the
 * test browser cannot emulate the media feature, so the rules are copied into a plain style tag.
 */
function forceReducedMotion(doc: Document): () => void {
  const rules: string[] = [];
  for (const sheet of doc.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSMediaRule &&
        /prefers-reduced-motion:\s*reduce/.test(rule.conditionText)
      ) {
        for (const inner of rule.cssRules) rules.push(inner.cssText);
      }
    }
  }
  const style = doc.createElement("style");
  style.textContent = rules.join("\n");
  doc.head.append(style);
  return () => style.remove();
}

/** The three slabs' footprint: how far apart they sit. */
const footprint = (art: Element) => {
  const boxes = [...art.querySelectorAll(".ui-auth-face-top")].map((face) =>
    face.getBoundingClientRect(),
  );
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.right));
  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return (right - left) * (bottom - top);
};

const meta = {
  title: "Auth/AuthIllustration",
  component: AuthIllustration,
  tags: ["autodocs"],
  args: { state: "idle", progress: 0, activeIndex: 0 },
  argTypes: {
    state: { control: "inline-radio", options: AUTH_STATES },
    progress: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    activeIndex: { control: "inline-radio", options: [0, 1, 2] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthIllustration>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-hidden=true] svg")).not.toBeNull();
    await expect(canvasElement.querySelector("[tabindex], a, button, input")).toBeNull();
  },
};

export const TypingIdentifier: Story = { args: { state: "typing", progress: 0.3 } };

export const TypingPassword: Story = { args: { state: "password", progress: 0.8 } };

export const Failed: Story = { args: { state: "error", progress: 0.6 } };

/** An error holds for about a second, then the art settles back to the password state by itself. */
export const FailedSettles: Story = {
  args: { state: "error", progress: 0.6 },
  play: async ({ canvasElement }) => {
    const art = canvasElement.querySelector(".ui-auth-art") as HTMLElement;
    await expect(art).toHaveAttribute("data-state", "error");
    await waitFor(() => expect(art).toHaveAttribute("data-state", "password"), { timeout: 2500 });
  },
};

export const Success: Story = { args: { state: "success", progress: 1 } };

export const FamilyPortal: Story = { args: { activeIndex: 1 } };

export const Labelled: Story = {
  args: { label: "Three portals: staff, families and students" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("img", { name: /three portals/i })).toBeVisible();
  },
};

export const States: Story = {
  decorators: [
    () => (
      <div className="grid gap-6 @container grid-cols-2">
        {AUTH_STATES.map((state) => (
          <figure key={state} className="m-0">
            <AuthIllustration state={state} progress={state === "password" ? 0.75 : 0.3} />
            <figcaption className="text-center text-ink-3 text-meta">{state}</figcaption>
          </figure>
        ))}
      </div>
    ),
  ],
};

/**
 * With reduced motion nothing moves, but every state keeps its own still pose: the slabs sit wide
 * at rest, closer while typing, together for the password and on success, and flung apart on an
 * error (with a static spark burst on success); the mosaic floor turns red on an error.
 */
export const ReducedMotionKeepsState: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      {(["idle", "typing", "password", "error", "success"] as const).map((state) => (
        <AuthIllustration
          key={state}
          data-testid={state}
          state={state}
          progress={state === "typing" ? 0.3 : state === "idle" ? 0 : 1}
        />
      ))}
      <AuthIllustration look={Mosaic} data-testid="mosaic-error" state="error" progress={0.5} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const restore = forceReducedMotion(canvasElement.ownerDocument);
    try {
      const art = (state: string) => within(canvasElement).getByTestId(state);
      const size = Object.fromEntries(
        ["idle", "typing", "password", "error", "success"].map((state) => [
          state,
          footprint(art(state)),
        ]),
      );
      // Measured inside the error hold, before the art settles back to the password pose.
      await expect(art("error")).toHaveAttribute("data-state", "error");
      await expect(size.error).toBeGreaterThan(size.idle * 1.3);
      await expect(size.idle).toBeGreaterThan(size.typing);
      await expect(size.typing).toBeGreaterThan(size.password);
      await expect(size.password).toBeGreaterThanOrEqual(size.success);
      const sparks = [...art("success").querySelectorAll(".ui-auth-spark")];
      await expect(sparks.length).toBeGreaterThan(0);
      for (const spark of sparks) await expect(getComputedStyle(spark).opacity).toBe("1");
      const tint = art("mosaic-error").querySelector(".ui-msc-alarm") as Element;
      await waitFor(() => expect(Number(getComputedStyle(tint).opacity)).toBeGreaterThan(0));
      await expect(
        canvasElement.ownerDocument
          .getAnimations()
          // The global reduced-motion rule leaves 0.01ms transitions while the rules switch on.
          .filter(
            (animation) =>
              Number(animation.effect?.getTiming().duration) > 1 &&
              canvasElement.contains(
                ((animation.effect as KeyframeEffect | null)?.target as Element | null) ?? null,
              ),
          )
          .map((animation) => {
            const target = (animation.effect as KeyframeEffect).target as Element;
            const name =
              (animation as CSSAnimation).animationName ??
              (animation as CSSTransition).transitionProperty;
            return `${name} on ${target.getAttribute("class")}`;
          }),
      ).toEqual([]);
    } finally {
      restore();
    }
  },
};

/** Settling from an error back to the password pose does not replay the last keystroke's hop. */
export const ErrorSettlesWithoutHop: Story = {
  args: { state: "error", progress: 0.8 },
  play: async ({ canvasElement }) => {
    const art = canvasElement.querySelector(".ui-auth-art") as HTMLElement;
    await waitFor(() => expect(art).toHaveAttribute("data-state", "password"), { timeout: 2500 });
    const hops = canvasElement.ownerDocument
      .getAnimations()
      .filter((animation) => (animation as CSSAnimation).animationName?.startsWith("ui-auth-hop"));
    await expect(hops).toHaveLength(0);
  },
};

/** A media query list whose `matches` the test can flip, firing `change` like the browser does. */
class FakeQuery extends EventTarget {
  constructor(
    readonly media: string,
    public matches: boolean,
  ) {
    super();
  }
  set(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

const queries = {
  fine: new FakeQuery("(hover: hover) and (pointer: fine)", true),
  reduced: new FakeQuery("(prefers-reduced-motion: reduce)", false),
};

/** The parallax follows the motion and pointer settings when they change while the page is open. */
export const PointerFollowsSettings: Story = {
  beforeEach: () => {
    const original = window.matchMedia;
    queries.fine.matches = true;
    queries.reduced.matches = false;
    window.matchMedia = ((media: string) =>
      media === queries.reduced.media
        ? queries.reduced
        : media === queries.fine.media
          ? queries.fine
          : original.call(window, media)) as typeof window.matchMedia;
    return () => {
      window.matchMedia = original;
    };
  },
  play: async ({ canvasElement }) => {
    const art = canvasElement.querySelector(".ui-auth-art") as HTMLElement;
    const point = () => {
      const box = art.getBoundingClientRect();
      art.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerType: "mouse",
          clientX: box.right,
          clientY: box.top,
          bubbles: true,
        }),
      );
    };
    point();
    await waitFor(() => expect(art.style.getPropertyValue("--px")).toBe("1"));
    queries.reduced.set(true);
    await expect(art.style.getPropertyValue("--px")).toBe("");
    point();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await expect(art.style.getPropertyValue("--px")).toBe("");
    queries.reduced.set(false);
    point();
    await waitFor(() => expect(art.style.getPropertyValue("--px")).toBe("1"));
    queries.fine.set(false);
    await expect(art.style.getPropertyValue("--px")).toBe("");
  },
};
