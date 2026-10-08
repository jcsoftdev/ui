import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Avatar } from "../../atoms/avatar/avatar.js";
import { Chip } from "../../atoms/chip/chip.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card.js";

const meta = {
  title: "Overlays/HoverCard",
  component: HoverCard,
  tags: ["autodocs"],
  args: { openDelay: 300, closeDelay: 150, children: null },
  argTypes: {
    openDelay: { control: { type: "number", min: 0, step: 50 } },
    closeDelay: { control: { type: "number", min: 0, step: 50 } },
    children: { control: false },
    open: { control: false },
    onOpenChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-56 w-full max-w-md items-start justify-center pt-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function Barbero({ container }: { container?: HTMLElement | null }) {
  return (
    <>
      <HoverCardTrigger asChild>
        <a
          href="#diego"
          className="rounded-chip font-semibold text-accent-ink underline underline-offset-2 focus-visible:focus-ring"
        >
          @diego.quispe
        </a>
      </HoverCardTrigger>
      <HoverCardContent container={container}>
        <div className="flex gap-density">
          <Avatar name="Diego Quispe" size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-row-title text-ink">Diego Quispe</span>
            <span className="text-ink-3 text-meta">Barbero senior desde 2019</span>
            <div className="flex flex-wrap gap-density-sm pt-1">
              <Chip tone="accent">Degradados</Chip>
              <Chip tone="success">Disponible hoy</Chip>
            </div>
            <span className="pt-1 text-ink-2 text-meta">Próxima cita libre: 16:30</span>
          </div>
        </div>
      </HoverCardContent>
    </>
  );
}

export const Default: Story = {
  render: (args) => (
    <HoverCard {...args}>
      <Barbero />
    </HoverCard>
  ),
};

export const OpenByDefault: Story = {
  render: (args) => (
    <HoverCard {...args} defaultOpen>
      <Barbero />
    </HoverCard>
  ),
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <HoverCard {...args} defaultOpen>
      <Barbero />
    </HoverCard>
  ),
};

/** The card renders in a portal, so a scoped preset needs the portal inside the scoped element. */
export const BrutalPreset: Story = {
  render: function Render(args) {
    const [scope, setScope] = useState<HTMLElement | null>(null);
    return (
      <div ref={setScope} data-style="brutal" className="relative p-card">
        <HoverCard {...args} defaultOpen>
          <Barbero container={scope} />
        </HoverCard>
      </div>
    );
  },
};
