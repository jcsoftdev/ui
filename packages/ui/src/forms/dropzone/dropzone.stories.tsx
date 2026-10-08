import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Dropzone } from "./dropzone.js";

const meta = {
  title: "Forms/Dropzone",
  component: Dropzone,
  tags: ["autodocs"],
  args: {
    title: "Arrastra la foto del corte",
    hint: "PNG o JPG, máximo 2 MB",
    browseLabel: "Elegir archivo",
    acceptedTypes: ["image/*"],
    maxSizeBytes: 2 * 1024 * 1024,
    multiple: true,
    onFiles: () => {},
  },
  argTypes: {
    title: { control: "text" },
    hint: { control: "text" },
    browseLabel: { control: "text" },
    multiple: { control: "boolean" },
    maxSizeBytes: { control: "number" },
    acceptedTypes: { control: "object" },
    onFiles: { action: "files" },
    onReject: { action: "rejected" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Dropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleFile: Story = {
  args: { multiple: false, title: "Logo de la barbería", hint: "Un solo archivo" },
};

export const OnlyPdf: Story = {
  args: {
    title: "Sube la factura del proveedor",
    hint: "PDF, máximo 5 MB",
    acceptedTypes: ["application/pdf"],
    maxSizeBytes: 5 * 1024 * 1024,
  },
};

export const WithFeedback: Story = {
  render: (args) => {
    const [names, setNames] = useState<string[]>([]);
    const [error, setError] = useState<string>();
    return (
      <div className="flex flex-col gap-2">
        <Dropzone
          {...args}
          onFiles={(files) => {
            setError(undefined);
            setNames(files.map((f) => f.name));
          }}
          onReject={(r) => setError(`${r.length} archivo(s) rechazado(s)`)}
        />
        {names.length > 0 ? <p className="text-ink-2 text-meta">{names.join(", ")}</p> : null}
        {error ? <p className="font-semibold text-danger text-meta">{error}</p> : null}
      </div>
    );
  },
};
