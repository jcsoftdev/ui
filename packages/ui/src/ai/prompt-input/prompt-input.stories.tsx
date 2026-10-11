import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Paperclip } from "../../icons/index.js";
import { Attachment } from "../attachment/attachment.js";
import { PromptInput } from "./prompt-input.js";

const meta = {
  title: "AI/PromptInput",
  component: PromptInput,
  tags: ["autodocs"],
  args: {
    placeholder: "Pregunta por turnos, clientes o ingresos…",
    hint: "Enter envía · Shift+Enter agrega una línea",
    streaming: false,
    disabled: false,
    maxRows: 6,
    onSubmit: () => {},
    onStop: () => {},
  },
  argTypes: {
    placeholder: { control: "text" },
    hint: { control: "text" },
    streaming: { control: "boolean" },
    disabled: { control: "boolean" },
    maxRows: { control: { type: "number", min: 1, max: 12 } },
    attachments: { control: false },
    actions: { control: false },
    onSubmit: { control: false },
    onStop: { control: false },
    onValueChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PromptInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const attach = (
  <button
    type="button"
    aria-label="Adjuntar archivo"
    className="inline-grid size-8 cursor-pointer place-items-center rounded-button text-ink-3 pressable hover:bg-surface-2 hover:text-ink focus-visible:focus-ring"
  >
    <Paperclip aria-hidden className="size-4" />
  </button>
);

export const Default: Story = { args: { actions: attach } };

export const WithAttachments: Story = {
  args: {
    actions: attach,
    defaultValue: "Resume este reporte por barbero",
    attachments: (
      <>
        <Attachment name="ingresos-junio.xlsx" size="82 KB" onRemove={() => {}} />
        <Attachment name="agenda.pdf" status="uploading" progress={60} onRemove={() => {}} />
      </>
    ),
  },
};

export const Streaming: Story = { args: { streaming: true, actions: attach } };

export const Echo: Story = {
  render: (args) => {
    const [sent, setSent] = useState<string[]>([]);
    return (
      <div className="grid gap-density">
        <ul className="grid gap-1 text-meta text-ink-2">
          {sent.map((text, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: demo list never reorders
            <li key={i} className="whitespace-pre-wrap">
              Enviado: {text}
            </li>
          ))}
        </ul>
        <PromptInput {...args} onSubmit={(text) => setSent((list) => [...list, text])} />
      </div>
    );
  },
};

export const Narrow: Story = {
  args: { actions: attach },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  args: { actions: attach },
  decorators: [
    (Story) => (
      <div data-style="brutal" className="max-w-xl bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
