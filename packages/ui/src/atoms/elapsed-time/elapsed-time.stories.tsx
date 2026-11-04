import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { ElapsedTime } from "./elapsed-time.js";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000 - 14_000);

const meta = {
  title: "Atoms/ElapsedTime",
  component: ElapsedTime,
  tags: ["autodocs"],
  args: { since: minutesAgo(12) },
  argTypes: {
    format: { control: "inline-radio", options: ["mm:ss", "minutes"] },
    warnAt: { control: { type: "number", min: 0 } },
    dangerAt: { control: { type: "number", min: 0 } },
    serverOffsetMs: { control: { type: "number" } },
  },
} satisfies Meta<typeof ElapsedTime>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const time = canvasElement.querySelector("time") as HTMLElement;
    await expect(time.getAttribute("datetime")).toMatch(/^PT12M\d+S$/);
    await expect(time.querySelector(".sr-only")).toHaveTextContent("12 minutes");
    await expect(canvasElement.querySelector("[aria-live]")).toBeNull();
  },
};

export const Minutes: Story = { args: { format: "minutes" } };

export const Warning: Story = {
  args: { since: minutesAgo(11), warnAt: 10, dangerAt: 20 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("time")).toHaveAttribute("data-tone", "warning");
  },
};

export const Danger: Story = {
  args: { since: minutesAgo(24), warnAt: 10, dangerAt: 20 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("time")).toHaveAttribute("data-tone", "danger");
  },
};

export const Countdown: Story = {
  args: {
    since: new Date(),
    countdownTo: new Date(Date.now() + 4 * 60_000 + 30_000),
    warnAt: 5,
    dangerAt: 2,
  },
  play: async ({ canvasElement }) => {
    const time = canvasElement.querySelector("time") as HTMLElement;
    await expect(time).toHaveAttribute("data-countdown");
    await expect(time.querySelector(".sr-only")).toHaveTextContent(/left/);
  },
};

export const ServerOffset: Story = {
  args: { since: new Date(Date.now() - 3 * 60_000), serverOffsetMs: 5 * 60_000 },
};

export const SharedTicker: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-4 text-body">
      {[2, 8, 11, 19, 27].map((minutes) => (
        <ElapsedTime
          key={minutes}
          {...args}
          since={minutesAgo(minutes)}
          warnAt={10}
          dangerAt={20}
        />
      ))}
    </div>
  ),
};

export const Spanish: Story = {
  render: (args) => (
    <UiStringsProvider locale="es">
      <ElapsedTime {...args} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(".sr-only")).toHaveTextContent("12 minutos");
  },
};

export const Dark: Story = { globals: { theme: "dark" }, args: { warnAt: 10, dangerAt: 20 } };
