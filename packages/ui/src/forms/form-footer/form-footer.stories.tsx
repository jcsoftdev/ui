import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { Input } from "../input/index.js";
import { FormFooter } from "./form-footer.js";

const meta = {
  title: "Forms/FormFooter",
  component: FormFooter,
  tags: ["autodocs"],
  args: { onCancel: () => {}, dirty: false, busy: false },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dirty: Story = { args: { dirty: true } };
export const Busy: Story = { args: { dirty: true, busy: true } };

function Pinned() {
  const [busy, setBusy] = useState(false);
  return (
    <Form
      className="h-72 overflow-auto"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setTimeout(() => setBusy(false), 1500);
      }}
    >
      {Array.from({ length: 8 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static demo list
        <Field key={i} label={`Campo ${i + 1}`}>
          <Input />
        </Field>
      ))}
      <FormFooter dirty busy={busy} onCancel={() => {}} />
    </Form>
  );
}

/** The footer stays at the bottom of the scrolling form. */
export const StickyInScrollingForm: Story = { render: () => <Pinned /> };
