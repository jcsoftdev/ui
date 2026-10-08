import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./popover.js";

function ClientCard() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <p className="m-0 font-semibold text-[13px]">Luis Ramírez</p>
      <p className="m-0 text-[12px] text-ink-3">14 visitas · Barbero habitual: Diego Quispe</p>
      <p className="m-0 text-[12px] text-ink-2">Último servicio: Corte + barba (S/ 45)</p>
      <PopoverClose asChild>
        <Button size="sm" variant="secondary">
          Cerrar
        </Button>
      </PopoverClose>
    </div>
  );
}

const meta = {
  title: "Overlays/Popover",
  component: PopoverContent,
  tags: ["autodocs"],
  args: { align: "center", side: "bottom", sideOffset: 6 },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    sideOffset: { control: "number" },
    children: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof PopoverContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Ver cliente</Button>
      </PopoverTrigger>
      <PopoverContent {...args}>
        <ClientCard />
      </PopoverContent>
    </Popover>
  ),
};

export const OpenByDefault: Story = {
  render: (args) => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="secondary">Ver cliente</Button>
      </PopoverTrigger>
      <PopoverContent {...args}>
        <ClientCard />
      </PopoverContent>
    </Popover>
  ),
};

export const TopEnd: Story = {
  args: { side: "top", align: "end" },
  render: (args) => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="secondary">Ver cliente</Button>
      </PopoverTrigger>
      <PopoverContent {...args}>
        <ClientCard />
      </PopoverContent>
    </Popover>
  ),
};
