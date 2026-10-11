import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../atoms/avatar/avatar.js";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { Scissors } from "../../icons/index.js";
import { GenericRow, GenericRowContent, GenericRowMeta, GenericRowTitle } from "./generic-row.js";

const meta = {
  title: "Containers/GenericRow",
  component: GenericRow,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <Avatar name="Luis Ramírez" />
        <GenericRowContent>
          <GenericRowTitle>Luis Ramírez</GenericRowTitle>
          <GenericRowMeta>Corte + barba · Hoy 16:30</GenericRowMeta>
        </GenericRowContent>
        <Chip tone="success">Confirmada</Chip>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-lg border border-line">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GenericRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HeterogeneousList: Story = {
  render: () => (
    <>
      <GenericRow>
        <Avatar name="Luis Ramírez" />
        <GenericRowContent>
          <GenericRowTitle>Luis Ramírez</GenericRowTitle>
          <GenericRowMeta>Corte + barba · Hoy 16:30</GenericRowMeta>
        </GenericRowContent>
        <Chip tone="success">Confirmada</Chip>
      </GenericRow>
      <GenericRow>
        <Scissors aria-hidden className="size-4 text-ink-3" />
        <GenericRowContent>
          <GenericRowTitle>Corte clásico</GenericRowTitle>
          <GenericRowMeta>30 min · S/ 25</GenericRowMeta>
        </GenericRowContent>
        <Button size="sm" variant="secondary">
          Editar
        </Button>
      </GenericRow>
      <GenericRow>
        <Avatar name="Camila Rojas" />
        <GenericRowContent>
          <GenericRowTitle>Camila Rojas</GenericRowTitle>
          <GenericRowMeta>Pidió cambio de hora</GenericRowMeta>
        </GenericRowContent>
        <Chip tone="warning">Pendiente</Chip>
      </GenericRow>
    </>
  ),
};

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
