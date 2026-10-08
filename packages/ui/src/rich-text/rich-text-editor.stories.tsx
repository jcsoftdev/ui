import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RichTextEditor, RichTextView } from "./rich-text-editor.js";

const meta = {
  title: "Forms/RichTextEditor",
  component: RichTextEditor,
  tags: ["autodocs"],
  args: {
    placeholder: "Describe el servicio…",
    minHeightRem: 8,
    "aria-label": "Descripción del servicio",
  },
  argTypes: {
    placeholder: { control: "text" },
    minHeightRem: { control: "number" },
    disabled: { control: "boolean" },
    value: { control: false },
    defaultValue: { control: false },
    onChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE =
  '<h2>Corte clásico</h2><p>Incluye <strong>lavado</strong>, corte a tijera y <em>perfilado</em> con navaja.</p><ul><li>Duración: 30 min</li><li>Precio: S/ 35</li></ul><p>Reserva en <a href="https://barberia.example/citas">nuestra agenda</a>.</p>';

export const Default: Story = { args: { defaultValue: SAMPLE } };

export const Empty: Story = {};

export const Disabled: Story = { args: { defaultValue: SAMPLE, disabled: true } };

function Live() {
  const [html, setHtml] = useState(SAMPLE);
  return (
    <div className="flex flex-col gap-density">
      <RichTextEditor value={html} onChange={setHtml} aria-label="Descripción" />
      <p className="text-ink-3 text-overline">Vista previa (sanitizada)</p>
      <RichTextView html={html} className="rounded-card border-card p-card" />
      <pre className="overflow-x-auto rounded-card bg-surface-sunken p-card text-ink-2 text-meta whitespace-pre-wrap [overflow-wrap:anywhere]">
        {html}
      </pre>
    </div>
  );
}

export const WithPreview: Story = { render: () => <Live /> };

export const HostileInput: Story = {
  args: {
    defaultValue:
      '<p onclick="alert(1)">Texto</p><img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)">enlace</a>',
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: { defaultValue: SAMPLE },
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="w-full max-w-xl bg-surface p-card">
        <Story />
      </div>
    ),
  ],
  args: { defaultValue: SAMPLE },
};
