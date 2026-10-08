import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageActions } from "../message-actions/message-actions.js";
import { ChatMessage } from "./chat-message.js";

const meta = {
  title: "AI/ChatMessage",
  component: ChatMessage,
  tags: ["autodocs"],
  args: {
    author: "assistant",
    name: "Asistente",
    status: "done",
    time: "10:42",
    content:
      "Mañana tienes **tres huecos libres** con Diego: `10:00`, `11:30` y `16:00`. ¿Quieres que reserve alguno?",
  },
  argTypes: {
    author: { control: "inline-radio", options: ["user", "assistant", "system"] },
    status: { control: "inline-radio", options: ["sending", "streaming", "done", "error"] },
    name: { control: "text" },
    time: { control: "text" },
    content: { control: "text" },
    errorText: { control: "text" },
    avatarSrc: { control: "text" },
    footer: { control: false },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const User: Story = {
  args: {
    author: "user",
    name: "Luis Paredes",
    content: "¿Tienes algún turno libre mañana por la mañana?",
  },
};

export const System: Story = {
  args: { author: "system", name: "Sistema", content: "Hoy, 20 de junio · Sede Miraflores" },
};

export const Streaming: Story = {
  args: {
    status: "streaming",
    time: undefined,
    content: "Estoy revisando la agenda de Diego para mañana y veo",
  },
};

export const Waiting: Story = { args: { status: "streaming", content: "", time: undefined } };

export const Failed: Story = {
  args: {
    author: "user",
    name: "Luis Paredes",
    status: "error",
    content: "Reserva el de las 10:00",
    time: undefined,
  },
};

export const WithActions: Story = {
  args: {
    footer: (
      <MessageActions
        text="Mañana tienes tres huecos libres."
        onRegenerate={() => {}}
        onFeedback={() => {}}
      />
    ),
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="grid max-w-xl gap-density bg-bg p-card">
        <ChatMessage author="user" name="Luis Paredes" content="¿Tienes turno mañana?" />
        <Story />
      </div>
    ),
  ],
};
