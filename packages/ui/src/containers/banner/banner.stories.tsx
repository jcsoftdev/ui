import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { AlertTriangle, CheckCircle2, Info, XOctagon } from "../../icons/index.js";
import { Banner } from "./banner.js";

const meta = {
  title: "Containers/Banner",
  component: Banner,
  tags: ["autodocs"],
  args: {
    tone: "info",
    children: "Hoy la barbería abre una hora más tarde, a las 10:00.",
    icon: <Info className="size-4" />,
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["info", "success", "warning", "danger"] },
    icon: { control: false },
    action: { control: false },
    children: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Success: Story = {
  args: {
    tone: "success",
    icon: <CheckCircle2 className="size-4" />,
    children: "Cita confirmada: Corte + barba con Diego Quispe, sábado 11:30.",
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    icon: <AlertTriangle className="size-4" />,
    children: "Quedan 3 frascos de pomada mate. Repón el inventario antes del fin de semana.",
  },
};

export const Danger: Story = {
  args: {
    tone: "danger",
    icon: <XOctagon className="size-4" />,
    children: "No se pudo registrar el pago de S/ 45. Revisa la conexión del POS.",
  },
};

export const WithAction: Story = {
  args: {
    tone: "danger",
    icon: <XOctagon className="size-4" />,
    children: "No se pudo registrar el pago de S/ 45.",
    action: <Button size="sm">Reintentar</Button>,
  },
};

export const WithoutIcon: Story = { args: { icon: null } };

/** Without `icon`, each tone gets its own glyph so status never depends on color alone. */
export const DefaultIcons: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(["info", "success", "warning", "danger"] as const).map((tone) => (
        <Banner key={tone} {...args} tone={tone} icon={undefined}>
          {tone}
        </Banner>
      ))}
    </div>
  ),
};

export const WithTitle: Story = {
  args: {
    tone: "danger",
    icon: undefined,
    title: "No se pudo registrar el pago",
    children: "Revisa la conexión del POS e inténtalo de nuevo.",
  },
};

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const Outline: Story = {
  args: { appearance: "outline", title: "Heads up", icon: undefined },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(["info", "success", "warning", "danger"] as const).map((tone) => (
        <Banner key={tone} {...args} tone={tone}>
          The tone only colors the border; the glyph and the role carry the meaning.
        </Banner>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const banners = within(canvasElement).getAllByRole("status");
    await expect(banners).toHaveLength(3);
    await expect(within(canvasElement).getByRole("alert")).toHaveAttribute(
      "data-appearance",
      "outline",
    );
  },
};
