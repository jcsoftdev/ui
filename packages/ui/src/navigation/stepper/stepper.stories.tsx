import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stepper } from "./stepper.js";

const steps = [
  { id: "servicio", label: "Servicio" },
  { id: "barbero", label: "Barbero" },
  { id: "horario", label: "Horario" },
  { id: "confirmar", label: "Confirmar" },
];

const meta = {
  title: "Navigation/Stepper",
  component: Stepper,
  tags: ["autodocs"],
  args: { steps, currentStepId: "barbero" },
  argTypes: {
    steps: { control: "object" },
    currentStepId: { control: "inline-radio", options: steps.map((s) => s.id) },
    className: { control: "text" },
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstStep: Story = { args: { currentStepId: "servicio" } };

export const LastStep: Story = { args: { currentStepId: "confirmar" } };

export const ThreeSteps: Story = {
  args: {
    steps: [
      { id: "cliente", label: "Cliente" },
      { id: "cobro", label: "Cobro" },
      { id: "recibo", label: "Recibo" },
    ],
    currentStepId: "cobro",
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};
