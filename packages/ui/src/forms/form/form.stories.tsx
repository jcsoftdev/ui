import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../atoms/button/button.js";
import { Field } from "../field/field.js";
import { Input } from "../input/input.js";
import { Form, FormError, type FormProps, FormStatus } from "./form.js";

const meta = {
  title: "Forms/Form",
  component: Form,
  subcomponents: { FormError, FormStatus },
  tags: ["autodocs"],
  args: { noValidate: false, autoComplete: "on" },
  argTypes: {
    noValidate: { control: "boolean" },
    autoComplete: { control: "inline-radio", options: ["on", "off"] },
    action: { control: "text" },
    method: { control: "inline-radio", options: ["get", "post", "dialog"] },
    "aria-label": { control: "text" },
    className: { control: "text" },
    children: { control: false },
    onSubmit: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo(props: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  return (
    <Form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        const email = new FormData(event.currentTarget).get("email");
        setStatus(null);
        setError(null);
        if (email) setStatus("Invitation sent.");
        else setError("Enter an email address.");
      }}
    >
      <Field label="Email">
        <Input name="email" type="email" />
      </Field>
      <FormError message={error} />
      <FormStatus message={status} />
      <Button type="submit">Invite</Button>
    </Form>
  );
}

/** Submit with an empty field for the error, with a value for the confirmation. */
export const Default: Story = { render: (args) => <Demo {...args} /> };
