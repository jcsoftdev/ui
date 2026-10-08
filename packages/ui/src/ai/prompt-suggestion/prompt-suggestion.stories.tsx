import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptSuggestion, PromptSuggestionList } from "./prompt-suggestion.js";

const meta = {
  title: "AI/PromptSuggestion",
  component: PromptSuggestion,
  tags: ["autodocs"],
  args: { children: "¿Qué turnos libres hay mañana?", onSelect: () => {} },
  argTypes: { children: { control: "text" }, onSelect: { control: false } },
} satisfies Meta<typeof PromptSuggestion>;

export default meta;
type Story = StoryObj<typeof meta>;

const SUGGESTIONS = [
  "¿Qué turnos libres hay mañana?",
  "Resume los ingresos de la semana",
  "¿Qué productos están por agotarse?",
  "Redacta un recordatorio para los clientes de mañana",
];

export const Default: Story = {};

export const List: Story = {
  render: () => (
    <PromptSuggestionList className="max-w-xl">
      {SUGGESTIONS.map((text) => (
        <PromptSuggestion key={text}>{text}</PromptSuggestion>
      ))}
    </PromptSuggestionList>
  ),
};

export const Narrow: Story = {
  render: () => (
    <PromptSuggestionList className="w-[320px]">
      {SUGGESTIONS.map((text) => (
        <PromptSuggestion key={text}>{text}</PromptSuggestion>
      ))}
    </PromptSuggestionList>
  ),
};

export const PresetBrutal: Story = {
  render: () => (
    <div data-style="brutal" className="bg-bg p-card">
      <PromptSuggestionList className="max-w-xl">
        {SUGGESTIONS.map((text) => (
          <PromptSuggestion key={text}>{text}</PromptSuggestion>
        ))}
      </PromptSuggestionList>
    </div>
  ),
};
