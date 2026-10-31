import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { ChatThread, type ChatThreadItem } from "./chat-thread.js";

const now = new Date("2026-10-29T15:00:00Z");

const items: ChatThreadItem[] = [
  {
    id: "1",
    author: "customer",
    name: "Rosa",
    at: "2026-10-28T20:02:00Z",
    content: "Buenas noches, ¿tienen delivery a Surco?",
  },
  {
    id: "2",
    author: "bot",
    at: "2026-10-28T20:02:20Z",
    content: "¡Hola Rosa! Sí, llegamos a Surco en unos 35 minutos. ¿Qué te provoca pedir?",
    status: "read",
  },
  {
    id: "3",
    kind: "note",
    at: "2026-10-29T14:40:00Z",
    content: "El cliente pidió hablar con una persona",
  },
  {
    id: "4",
    author: "customer",
    name: "Rosa",
    at: "2026-10-29T14:41:00Z",
    content: "Mi pedido llegó incompleto",
  },
  {
    id: "5",
    author: "staff",
    name: "Ana",
    at: "2026-10-29T14:44:00Z",
    content: "Lo siento mucho, Rosa. Te enviamos lo que falta ahora mismo.",
    status: "delivered",
  },
  {
    id: "6",
    author: "staff",
    name: "Ana",
    at: "2026-10-29T14:45:00Z",
    content: "¿Nos confirmas tu dirección?",
    status: "failed",
  },
];

const meta = {
  title: "Containers/ChatThread",
  component: ChatThread,
  tags: ["autodocs"],
  args: { items, now, locale: "es", timeZone: "America/Lima" },
  argTypes: { items: { control: false }, composer: { control: false } },
  decorators: [
    (Story) => (
      <div className="h-[32rem] max-w-xl rounded-card border-card surface-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatThread>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithComposer: Story = {
  args: {
    onRetry: () => {},
    composer: (
      <div className="flex gap-2">
        <input
          aria-label="Mensaje"
          placeholder="Escribe un mensaje"
          className="min-w-0 flex-1 rounded-input border-card bg-transparent px-3 py-2 text-body"
        />
        <Button variant="primary">Enviar</Button>
      </div>
    ),
  },
};

export const Empty: Story = {
  args: { items: [], empty: <p className="m-0 text-body text-ink-3">Aún no hay mensajes</p> },
};
