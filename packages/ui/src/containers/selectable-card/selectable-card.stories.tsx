import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { SelectableCard } from "./selectable-card.js";

const meta = {
  title: "Containers/SelectableCard",
  component: SelectableCard,
  tags: ["autodocs"],
  args: {
    onClick: fn(),
    children: (
      <>
        <span className="font-semibold text-ink">Delivery</span>
        <span className="text-ink-3 text-meta">Llega en 35 min</span>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SelectableCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Without `selected` the card is a plain button. */
export const Button: Story = {};

export const Toggle: Story = { args: { selected: true } };

export const Disabled: Story = {
  args: { selected: false, disabled: true, disabledReason: "Cerrado hoy" },
};

/** One selected card in a group: radio semantics. */
export const RadioGroup: Story = {
  render: () => {
    const [value, setValue] = useState("delivery");
    const options = [
      { id: "delivery", label: "Delivery" },
      { id: "local", label: "Comer en el local" },
    ];
    return (
      <div role="radiogroup" aria-label="Tipo de pedido" className="flex flex-col gap-2">
        {options.map((option) => (
          <SelectableCard
            key={option.id}
            semantics="radio"
            selected={value === option.id}
            onClick={() => setValue(option.id)}
          >
            <span className="font-semibold text-ink">{option.label}</span>
          </SelectableCard>
        ))}
      </div>
    );
  },
};
