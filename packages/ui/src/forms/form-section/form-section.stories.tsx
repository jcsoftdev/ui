import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { FormGrid } from "../form-grid/index.js";
import { Input } from "../input/index.js";
import { Textarea } from "../textarea/index.js";
import { FormSection } from "./form-section.js";

const meta = {
  title: "Forms/FormSection",
  component: FormSection,
  tags: ["autodocs"],
  args: { title: "Contacto", description: "Cómo nos comunicamos con la familia.", children: null },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sections: Story = {
  render: (args) => (
    <Form>
      <FormSection {...args}>
        <FormGrid>
          <Field label="Correo" required>
            <Input type="email" />
          </Field>
          <Field label="Teléfono" optional>
            <Input type="tel" />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Observaciones" description="Visible solo para el personal.">
        <Field label="Notas">
          <Textarea />
        </Field>
      </FormSection>
    </Form>
  ),
};

export const Narrow: Story = {
  render: Sections.render,
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};
