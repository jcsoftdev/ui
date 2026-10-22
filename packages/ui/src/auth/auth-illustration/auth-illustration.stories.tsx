import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { AuthIllustration } from "./auth-illustration.js";
import { AUTH_STATES } from "./model.js";

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
