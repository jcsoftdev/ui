import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { ChatMessage } from "../chat-message/chat-message.js";
import { Conversation } from "./conversation.js";

const LINES = [
  "¿Cuántos turnos tengo hoy?",
  "Tienes **12 turnos**: 7 por la mañana y 5 por la tarde.",
  "¿Y cuál es el siguiente?",
  "Luis Paredes a las `15:30`, corte + barba con Diego.",
  "Avísale que llegue 10 minutos antes.",
  "Listo, le envié el recordatorio por WhatsApp.",
];

function History({ count, grow }: { count: number; grow?: boolean }) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (!grow) return;
    const id = window.setInterval(() => setExtra((n) => n + 1), 1500);
    return () => window.clearInterval(id);
  }, [grow]);
  return (
    <>
      {Array.from({ length: count + extra }, (_, i) => (
        <ChatMessage
          // biome-ignore lint/suspicious/noArrayIndexKey: demo list never reorders
          key={i}
          author={i % 2 === 0 ? "user" : "assistant"}
          name={i % 2 === 0 ? "Luis Paredes" : "Asistente"}
          content={LINES[i % LINES.length]}
        />
      ))}
    </>
  );
}

const meta = {
  title: "AI/Conversation",
  component: Conversation,
  tags: ["autodocs"],
  args: { label: "Conversación con el asistente", jumpLabel: "Ir al último mensaje" },
  argTypes: { label: { control: "text" }, jumpLabel: { control: "text" } },
  decorators: [
    (Story) => (
      <div className="h-[420px] max-w-xl rounded-card bg-bg border-card shadow-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Conversation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Conversation {...args}>
      <History count={10} />
    </Conversation>
  ),
};

/** New messages arrive every 1,5 s; scroll up to pause the follow and use the button to resume. */
export const GrowingHistory: Story = {
  render: (args) => (
    <Conversation {...args}>
      <History count={6} grow />
    </Conversation>
  ),
};

export const Narrow: Story = {
  render: (args) => (
    <Conversation {...args}>
      <History count={8} />
    </Conversation>
  ),
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  render: (args) => (
    <Conversation {...args}>
      <History count={8} />
    </Conversation>
  ),
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
