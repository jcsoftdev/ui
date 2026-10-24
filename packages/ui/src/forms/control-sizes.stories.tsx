import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { IconButton } from "../atoms/icon-button/icon-button.js";
import { EllipsisVertical } from "../icons/index.js";
import { ChipGroup } from "./chip-group/chip-group.js";
import { Combobox } from "./combobox/combobox.js";
import { DatePicker } from "./date-picker/date-picker.js";
import { DateTimePicker } from "./date-picker/date-time-picker.js";
import { Input } from "./input/input.js";
import { Select } from "./select/select.js";
import { TimeInput } from "./time-input/time-input.js";

type Size = "sm" | "md";

function Row({ size }: { size: Size }) {
  return (
    <div data-size={size} className="flex flex-wrap items-center gap-2">
      <Button size={size}>Guardar</Button>
      <IconButton size={size} label={`Más acciones ${size}`}>
        <EllipsisVertical />
      </IconButton>
      <div className="w-40">
        <Input size={size} aria-label={`Nombre ${size}`} placeholder="Nombre" />
      </div>
      <div className="w-36">
        <Select size={size} aria-label={`Estado ${size}`}>
          <option>Activo</option>
          <option>Inactivo</option>
        </Select>
      </div>
      <div className="w-44">
        <Combobox
          size={size}
          aria-label={`Persona ${size}`}
          options={[{ value: "ana", label: "Ana Quispe" }]}
        />
      </div>
      <div className="w-44">
        <DatePicker size={size} aria-label={`Fecha ${size}`} defaultValue="2026-03-01" />
      </div>
      <div className="w-28">
        <TimeInput size={size} aria-label={`Hora ${size}`} defaultValue="09:30" />
      </div>
      <div className="w-80">
        <DateTimePicker size={size} aria-label={`Inicio ${size}`} defaultValue="2026-03-01T09:30" />
      </div>
      <ChipGroup
        size={size}
        aria-label={`Filtro ${size}`}
        type="single"
        defaultValue="open"
        options={[
          { value: "open", label: "Abiertos" },
          { value: "closed", label: "Cerrados" },
        ]}
      />
    </div>
  );
}

/**
 * One height per size: at `sm` every control is 30px (`--control-height-sm`) and at `md` 38px
 * (`--control-height-md`), so a button, a field, a picker and a filter chip line up in a toolbar or
 * a table row.
 */
const meta = {
  title: "Forms/Control sizes",
  component: Row,
  args: { size: "md" },
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

const EXPECTED: Record<Size, number> = { sm: 30, md: 38 };

async function expectOneHeight(canvasElement: HTMLElement, size: Size) {
  const canvas = within(canvasElement);
  const controls = [
    canvas.getByRole("button", { name: "Guardar" }),
    canvas.getByRole("button", { name: `Más acciones ${size}` }),
    canvas.getByRole("textbox", { name: `Nombre ${size}` }),
    canvas.getByRole("combobox", { name: `Estado ${size}` }),
    canvas.getByRole("combobox", { name: `Persona ${size}` }),
    canvas.getByRole("textbox", { name: `Fecha ${size}` }),
    canvas.getByRole("textbox", { name: `Hora ${size}` }),
    canvas.getByRole("textbox", { name: `Inicio ${size}` }),
  ];
  for (const control of controls) {
    await expect(Math.round(control.getBoundingClientRect().height)).toBe(EXPECTED[size]);
  }
  for (const chip of [
    canvas.getByRole("button", { name: "Abiertos" }),
    canvas.getByRole("button", { name: "Cerrados" }),
  ]) {
    await expect(Math.round(chip.getBoundingClientRect().height)).toBe(EXPECTED[size]);
  }
  const iconButton = canvas.getByRole("button", { name: `Más acciones ${size}` });
  await expect(Math.round(iconButton.getBoundingClientRect().width)).toBe(EXPECTED[size]);
  for (const name of ["Clear", "Open calendar"]) {
    for (const button of canvas.getAllByRole("button", { name })) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(30);
    }
  }
}

export const Medium: Story = {
  play: ({ canvasElement }) => expectOneHeight(canvasElement, "md"),
};

export const Small: Story = {
  args: { size: "sm" },
  play: ({ canvasElement }) => expectOneHeight(canvasElement, "sm"),
};
