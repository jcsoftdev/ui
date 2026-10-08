import type { Meta, StoryObj } from "@storybook/react-vite";
import { Attachment } from "./attachment.js";

const PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='100'><rect width='160' height='100' fill='%23c9a27e'/><circle cx='80' cy='46' r='24' fill='%238a5a35'/><rect x='40' y='70' width='80' height='30' rx='14' fill='%238a5a35'/></svg>";

const meta = {
  title: "AI/Attachment",
  component: Attachment,
  tags: ["autodocs"],
  args: {
    name: "agenda-sabado.pdf",
    size: "240 KB",
    variant: "chip",
    status: "done",
    onRemove: () => {},
  },
  argTypes: {
    name: { control: "text" },
    size: { control: "text" },
    previewSrc: { control: "text" },
    variant: { control: "inline-radio", options: ["chip", "preview"] },
    status: { control: "inline-radio", options: ["done", "uploading", "error"] },
    progress: { control: { type: "range", min: 0, max: 100, step: 5 } },
    onRemove: { control: false },
  },
} satisfies Meta<typeof Attachment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Uploading: Story = { args: { status: "uploading", progress: 45 } };

export const Failed: Story = { args: { status: "error" } };

export const Preview: Story = {
  args: { variant: "preview", name: "corte-referencia.png", size: "1,2 MB", previewSrc: PHOTO },
};

export const Narrow: Story = {
  args: { name: "reporte-mensual-de-ingresos-por-barbero-junio-2026.xlsx" },
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
      <div data-style="brutal" className="flex flex-wrap gap-density bg-bg p-card">
        <Story />
        <Attachment
          variant="preview"
          name="corte-referencia.png"
          size="1,2 MB"
          previewSrc={PHOTO}
          onRemove={() => {}}
        />
      </div>
    ),
  ],
};
