import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CircleCheck } from "../../icons/index.js";
import { StatusPill } from "./status-pill.js";

const meta = {
  title: "Atoms/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  args: { status: "success", label: "Caja abierta", onSelect: fn() },
  argTypes: {
    status: { control: "inline-radio", options: ["success", "warning", "danger", "idle"] },
    label: { control: "text" },
    onSelect: { control: false },
  },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Warning: Story = { args: { status: "warning", label: "Sincronizando" } };

export const Danger: Story = { args: { status: "danger", label: "Sin conexión" } };

export const Idle: Story = { args: { status: "idle", label: "Inactivo" } };

/** Without `onSelect` or `onClick` the pill is a plain `span`; `interactive` forces either element. */
export const Decorative: Story = {
  args: { onSelect: undefined, label: "Sucursal Miraflores" },
};

/** The icon is decorative and leads the pill in place of the dot; the label still names the status. `dot` brings the dot back. */
export const WithIcon: Story = { args: { icon: <CircleCheck /> } };

/** `collapseLabel` hides the visible label under 700 px of container width; the status stays announced. The default keeps the label visible. */
export const CollapsingLabel: Story = {
  args: { collapseLabel: true },
  decorators: [
    (Story) => (
      <div className="@container w-[360px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
