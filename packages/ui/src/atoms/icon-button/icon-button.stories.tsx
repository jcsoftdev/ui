import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Plus, Trash } from "../../icons/index.js";
import { IconButton } from "./icon-button.js";

const meta = {
  title: "Atoms/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: { label: "Delete row", children: <Trash aria-hidden="true" />, onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    children: { control: false },
    onClick: { control: false },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: "Delete row" });
    const box = button.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(Math.round(box.height));
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const VariantsAndSizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {(["primary", "secondary", "ghost", "danger"] as const).flatMap((variant) =>
        (["sm", "md", "lg"] as const).map((size) => (
          <IconButton
            key={`${variant}-${size}`}
            {...args}
            variant={variant}
            size={size}
            label={`${variant} ${size}`}
          >
            <Plus aria-hidden="true" />
          </IconButton>
        )),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of ["sm", "md", "lg"] as const) {
      const box = canvas.getByRole("button", { name: `primary ${size}` }).getBoundingClientRect();
      await expect(Math.round(box.width)).toBe(Math.round(box.height));
    }
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: "Delete row" });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toHaveAttribute("aria-busy", "true");
    button.focus();
    await expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(within(canvasElement).getByText("Loading")).toBeVisible();
  },
};

export const Disabled: Story = { args: { disabled: true } };
