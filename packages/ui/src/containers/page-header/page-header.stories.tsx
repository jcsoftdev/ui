import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderEyebrow,
  PageHeaderLede,
  PageHeaderTitle,
} from "./page-header.js";

const meta = {
  title: "Containers/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <div>
          <PageHeaderEyebrow>Sábado 11 de octubre</PageHeaderEyebrow>
          <PageHeaderTitle>
            Agenda de <span className="text-accent-word">hoy</span>
          </PageHeaderTitle>
          <PageHeaderLede>
            12 citas con 3 barberos. Quedan 2 horarios libres por la tarde.
          </PageHeaderLede>
        </div>
        <PageHeaderActions>
          <Button variant="secondary">Bloquear horario</Button>
          <Button>Nueva cita</Button>
        </PageHeaderActions>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  args: {
    children: (
      <div>
        <PageHeaderTitle>Inventario</PageHeaderTitle>
      </div>
    ),
  },
};

export const WithoutActions: Story = {
  args: {
    children: (
      <div>
        <PageHeaderEyebrow>Equipo</PageHeaderEyebrow>
        <PageHeaderTitle>Barberos</PageHeaderTitle>
        <PageHeaderLede>Diego Quispe, Mateo Flores y Camila Rojas.</PageHeaderLede>
      </div>
    ),
  },
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
