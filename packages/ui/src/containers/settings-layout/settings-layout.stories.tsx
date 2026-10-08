import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "../../atoms/switch/switch.js";
import { Card, CardHeader } from "../card/card.js";
import { SettingsRow } from "../settings-row/settings-row.js";
import {
  SettingsLayout,
  SettingsLayoutMain,
  SettingsLayoutNav,
  SettingsLayoutNavItem,
} from "./settings-layout.js";

const meta = {
  title: "Containers/SettingsLayout",
  component: SettingsLayout,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <SettingsLayoutNav aria-label="Secciones de configuración">
          <SettingsLayoutNavItem active>Negocio</SettingsLayoutNavItem>
          <SettingsLayoutNavItem>Horarios</SettingsLayoutNavItem>
          <SettingsLayoutNavItem>Servicios</SettingsLayoutNavItem>
          <SettingsLayoutNavItem>Notificaciones</SettingsLayoutNavItem>
        </SettingsLayoutNav>
        <SettingsLayoutMain>
          <Card>
            <CardHeader>
              <h3 className="m-0 font-semibold text-[14px]">Recordatorios</h3>
            </CardHeader>
            <SettingsRow
              title="Recordatorio por WhatsApp"
              description="Se envía 2 horas antes de la cita."
              control={<Switch defaultChecked aria-label="Recordatorio por WhatsApp" />}
            />
            <SettingsRow
              title="Reseña tras el servicio"
              description="Pide una reseña al terminar la cita."
              control={<Switch aria-label="Reseña tras el servicio" />}
            />
          </Card>
          <Card>
            <CardHeader>
              <h3 className="m-0 font-semibold text-[14px]">Cobros</h3>
            </CardHeader>
            <SettingsRow
              title="Aceptar Yape y Plin"
              control={<Switch defaultChecked aria-label="Aceptar Yape y Plin" />}
            />
          </Card>
        </SettingsLayoutMain>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="@container/page">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NarrowPage: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[640px]">
        <Story />
      </div>
    ),
  ],
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
