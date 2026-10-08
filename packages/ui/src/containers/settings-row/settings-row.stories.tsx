import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Switch } from "../../atoms/switch/switch.js";
import { SettingsRow } from "./settings-row.js";

const meta = {
  title: "Containers/SettingsRow",
  component: SettingsRow,
  tags: ["autodocs"],
  args: {
    title: "Recordatorio por WhatsApp",
    description: "Se envía al cliente 2 horas antes de la cita.",
    control: <Switch defaultChecked aria-label="Recordatorio por WhatsApp" />,
  },
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    control: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-lg border border-line">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithButton: Story = {
  args: {
    title: "Datos del negocio",
    description: "Razón social, RUC y dirección del local.",
    control: (
      <Button size="sm" variant="secondary">
        Editar
      </Button>
    ),
  },
};

export const WithoutDescription: Story = {
  args: { title: "Aceptar Yape y Plin", description: undefined },
};

export const WithoutControl: Story = {
  args: { title: "Plan actual", description: "Barbería Pro · S/ 89 al mes", control: undefined },
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
