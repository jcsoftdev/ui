import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCircle2, Info, XOctagon } from "lucide-react";
import { Button } from "../../atoms/button/button.js";
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

export const WithoutIcon: Story = { args: { icon: undefined } };

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
