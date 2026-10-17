import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Field } from "../field/field.js";
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

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};

const pdf = (name: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

// A real drop: unlike userEvent.upload it keeps the browser's own FileList on the input.
function drop(zone: HTMLElement, files: File[]) {
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);
  zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
}

export const FieldMode: Story = {
  args: { onFiles: undefined },
  render: () => {
    const onChange = fn();
    return (
      <form data-testid="form" className="flex flex-col gap-2">
        <Field label="Adjuntos" hint="Solo PDF">
          <Dropzone
            mode="field"
            name="docs"
            accept=".pdf,application/pdf"
            multiple
            showFiles
            title="Arrastra o elige archivos"
            browseLabel="Elegir archivo"
            onFiles={() => {}}
            onChange={(event) => onChange(event.target.files?.length)}
          />
        </Field>
        <button type="reset">Reset</button>
      </form>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The labelled file input is the control: Field's label names it.
    const input = canvas.getByLabelText("Adjuntos") as HTMLInputElement;
    await expect(input).toHaveAttribute("type", "file");
    await expect(input).toHaveAttribute("accept", ".pdf,application/pdf");
    await expect(input).toHaveAttribute("multiple");
    drop(input.parentElement as HTMLElement, [
      pdf("a.pdf"),
      new File(["x"], "b.png", { type: "image/png" }),
    ]);
    // The rejected image never reaches the input or the list.
    await expect(input.files?.length).toBe(1);
    await expect(await canvas.findByText("a.pdf")).toBeVisible();
    await expect(canvas.queryByText("b.png")).toBeNull();
    drop(input.parentElement as HTMLElement, [pdf("c.pdf"), pdf("d.pdf")]);
    await expect(await canvas.findByText("d.pdf")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Remove c.pdf" }));
    await expect(canvas.queryByText("c.pdf")).toBeNull();
    await expect(input.files?.length).toBe(1);
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await expect(canvas.queryByText("d.pdf")).toBeNull();
  },
};

export const FieldModeKeyboard: Story = {
  args: { onFiles: undefined },
  render: () => (
    <Dropzone
      mode="field"
      aria-label="Comprobante"
      title="Elige el comprobante"
      browseLabel="Elegir"
      onFiles={() => {}}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByLabelText("Comprobante")).toHaveFocus();
    await expect(canvas.getByLabelText("Comprobante")).toHaveAccessibleDescription(
      "Elige el comprobante",
    );
  },
};

export const FieldModeDrop: Story = {
  args: { onFiles: undefined },
  render: () => (
    <form data-testid="form">
      <Dropzone
        mode="field"
        name="docs"
        aria-label="Adjuntos"
        showFiles
        title="Arrastra"
        browseLabel="Elegir"
        accept=".pdf"
        onFiles={() => {}}
      />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Adjuntos") as HTMLInputElement;
    drop(input.parentElement as HTMLElement, [
      pdf("z.pdf"),
      new File(["x"], "w.png", { type: "image/png" }),
    ]);
    await expect(input.files?.length).toBe(1);
    await expect(await canvas.findByText("z.pdf")).toBeVisible();
    await expect(canvas.queryByText("w.png")).toBeNull();
    // A drop reaches the form as a real submission.
    const form = canvas.getByTestId("form") as HTMLFormElement;
    await expect((new FormData(form).get("docs") as File).name).toBe("z.pdf");
  },
};
