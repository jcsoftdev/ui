import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable.js";

const meta = {
  title: "Containers/Resizable",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
  args: { direction: "horizontal", children: null },
  argTypes: {
    direction: { control: "inline-radio", options: ["horizontal", "vertical"] },
    onLayout: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Block({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-density-sm p-card">
      <h3 className="m-0 text-card-title text-ink">{title}</h3>
      <p className="m-0 text-body text-ink-2">{children}</p>
    </div>
  );
}

function Demo({ direction }: { direction: "horizontal" | "vertical" }) {
  const [layout, setLayout] = useState<number[]>([]);
  return (
    <div className="flex w-full flex-col gap-density-sm">
      <ResizablePanelGroup
        direction={direction}
        onLayout={setLayout}
        aria-label="Agenda"
        className="h-80"
      >
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <Block title="Barberos">
            Diego Quispe, Rosa Mendoza y Luis Ramírez. Mínimo 15%, máximo 40%.
          </Block>
        </ResizablePanel>
        <ResizableHandle label="Redimensionar lista de barberos" />
        <ResizablePanel defaultSize={50} minSize={30}>
          <Block title="Agenda del día">
            Siete citas hoy. Arrastra la barra o usa las flechas (Mayús para pasos mayores).
          </Block>
        </ResizablePanel>
        <ResizableHandle label="Redimensionar detalle" />
        <ResizablePanel minSize={15}>
          <Block title="Detalle">Corte clásico para Luis Ramírez, S/ 35.</Block>
        </ResizablePanel>
      </ResizablePanelGroup>
      <p className="m-0 text-ink-3 text-meta tabular-nums">
        Distribución:{" "}
        {layout.length ? layout.map((n) => `${Math.round(n)}%`).join(" / ") : "inicial"}
      </p>
    </div>
  );
}

export const Default: Story = { render: () => <Demo direction="horizontal" /> };

export const Vertical: Story = { render: () => <Demo direction="vertical" /> };

export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => (
    <div className="w-[320px] max-w-full">
      <Demo direction="vertical" />
    </div>
  ),
};

export const BrutalPreset: Story = {
  render: () => (
    <div data-style="brutal" className="w-full bg-bg p-card">
      <Demo direction="horizontal" />
    </div>
  ),
};
