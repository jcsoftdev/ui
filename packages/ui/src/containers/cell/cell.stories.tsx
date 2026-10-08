import type { Meta, StoryObj } from "@storybook/react-vite";
import { Cell, type CellProps, type SwitchCellProps } from "./cell.js";

const meta = {
  title: "Containers/Cell",
  component: Cell,
  tags: ["autodocs"],
  args: {
    variant: "switch",
    title: "Recordatorio por WhatsApp",
    description: "Se envía al cliente 2 horas antes de la cita.",
    defaultChecked: true,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["switch", "select", "slider", "color"] },
    title: { control: "text" },
    description: { control: "text" },
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-card border-card shadow-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<SwitchCellProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Select: Story = {
  render: () => (
    <Cell
      {...({
        variant: "select",
        title: "Sede predeterminada",
        description: "Se usa al crear citas nuevas.",
        options: [
          { value: "miraflores", label: "Miraflores" },
          { value: "san-isidro", label: "San Isidro" },
          { value: "surco", label: "Surco" },
        ],
        defaultValue: "miraflores",
      } as CellProps)}
    />
  ),
};

export const Slider: Story = {
  render: () => (
    <Cell
      {...({
        variant: "slider",
        title: "Comisión del barbero",
        description: "Porcentaje sobre cada servicio.",
        min: 0,
        max: 60,
        step: 5,
        defaultValue: 40,
      } as CellProps)}
    />
  ),
};

export const Color: Story = {
  render: () => (
    <Cell
      {...({
        variant: "color",
        title: "Color de la agenda",
        colors: [
          { value: "coral", label: "Coral", swatch: "#e0674d" },
          { value: "azul", label: "Azul", swatch: "#2f6fdb" },
          { value: "verde", label: "Verde", swatch: "#2e9b6a" },
        ],
        defaultValue: "azul",
      } as CellProps)}
    />
  ),
};

export const List: Story = {
  render: () => (
    <>
      <Cell variant="switch" title="Recordatorio por WhatsApp" defaultChecked />
      <Cell
        variant="select"
        title="Sede predeterminada"
        options={[
          { value: "miraflores", label: "Miraflores" },
          { value: "san-isidro", label: "San Isidro" },
        ]}
        defaultValue="miraflores"
      />
      <Cell variant="slider" title="Comisión" min={0} max={60} step={5} defaultValue={40} />
    </>
  ),
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full rounded-card border-card shadow-card">
        <Story />
      </div>
    ),
  ],
  render: List.render,
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="max-w-xl bg-surface p-card">
        <div className="rounded-card border-card shadow-card">
          <Story />
        </div>
      </div>
    ),
  ],
  render: List.render,
};
