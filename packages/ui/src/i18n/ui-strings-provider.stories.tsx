import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "../forms/field/field.js";
import { Input } from "../forms/input/input.js";
import { ErrorState } from "../states/error-state/error-state.js";
import { Skeleton } from "../states/skeleton/skeleton.js";
import { UiStringsProvider } from "./ui-strings-provider.js";

const meta = {
  title: "Foundations/UiStringsProvider",
  component: UiStringsProvider,
  tags: ["autodocs"],
  args: { locale: "es", children: null },
  argTypes: {
    locale: { control: "inline-radio", options: ["en", "es"] },
    strings: { control: "object" },
    children: { control: false },
  },
  render: (args) => (
    <UiStringsProvider {...args}>
      <div className="flex max-w-sm flex-col gap-4">
        <Field label="Correo" optional>
          <Input />
        </Field>
        <ErrorState title="No pudimos cargar" correlationId="7f3a" onRetry={() => {}} />
        <Skeleton lines={2} />
      </div>
    </UiStringsProvider>
  ),
} satisfies Meta<typeof UiStringsProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spanish: Story = {};

export const English: Story = { args: { locale: "en" } };

export const WithOverride: Story = { args: { strings: { retry: "Probar otra vez" } } };
