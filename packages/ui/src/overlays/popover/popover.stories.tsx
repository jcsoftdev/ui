import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger } from "./popover.js";

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
  subcomponents: { Popover, PopoverTrigger, PopoverAnchor, PopoverClose },
  tags: ["autodocs"],
  args: { align: "center", side: "bottom", sideOffset: 6 },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    sideOffset: { control: "number" },
    children: { control: false },
    container: { control: false },
    material: {
      control: "select",
      options: ["solid", "glass", "glass-clear", "liquid", "liquid-clear"],
    },
    forceMount: { control: "boolean" },
    onOpenAutoFocus: { control: false },
    onCloseAutoFocus: { control: false },
    onEscapeKeyDown: { control: false },
    onPointerDownOutside: { control: false },
    onFocusOutside: { control: false },
    onInteractOutside: { control: false },
    alignOffset: { control: "number" },
    collisionPadding: { control: "object" },
    collisionBoundary: { control: false },
    avoidCollisions: { control: "boolean" },
    sticky: { control: "inline-radio", options: ["partial", "always"] },
    hideWhenDetached: { control: "boolean" },
    arrowPadding: { control: "number" },
    dir: { control: "inline-radio", options: ["ltr", "rtl"] },
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
  parameters: { a11y: { test: "todo" } },
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
  parameters: { a11y: { test: "todo" } },
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

/** `PopoverAnchor` positions the panel against another element than the trigger. */
export const AnchoredToElement: Story = {
  args: { side: "bottom", align: "start" },
  render: (args) => (
    <Popover>
      <PopoverAnchor asChild>
        <div className="flex items-center gap-3 rounded-tile border border-line bg-surface p-3">
          <span className="font-semibold text-[13px]">Luis Ramírez</span>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary">
              Ver ficha
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent {...args}>
        <ClientCard />
      </PopoverContent>
    </Popover>
  ),
};
