import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardBody, CardHeader } from "../card/card.js";
import { Cols, ColsStack } from "./cols.js";

function Panel({ title, children }: { title: string; children: string }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="m-0 font-semibold text-[14px]">{title}</h3>
      </CardHeader>
      <CardBody>
        <p className="m-0 text-ink-2 text-[13px]">{children}</p>
      </CardBody>
    </Card>
  );
}

const meta = {
  title: "Containers/Cols",
  component: Cols,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <Panel title="Agenda de hoy">12 citas, 3 por confirmar.</Panel>
        <Panel title="Barberos">Diego, Mateo y Camila en turno.</Panel>
      </>
    ),
  },
  argTypes: {
    variant: { control: "inline-radio", options: [undefined, "rail", "half", "calc"] },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="@container/page">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Cols>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Rail: Story = { args: { variant: "rail" } };

export const Half: Story = { args: { variant: "half" } };

export const Calc: Story = { args: { variant: "calc" } };

export const WithStack: Story = {
  render: (args) => (
    <Cols {...args}>
      <Panel title="Citas de la semana">48 citas, 92% de ocupación.</Panel>
      <ColsStack wideSplit>
        <Panel title="Ingresos">S/ 3 420 acumulados.</Panel>
        <Panel title="Inventario bajo">Pomada mate y navajas desechables.</Panel>
        <Panel title="Reseñas">4.8 de 5 en las últimas 30 reseñas.</Panel>
      </ColsStack>
    </Cols>
  ),
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
