import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Wallet } from "../../icons/index.js";
import { Card, CardBody, CardFooter, CardHeader } from "./card.js";

const meta = {
  title: "Containers/Card",
  component: Card,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <CardHeader>
          <h3 className="m-0 font-semibold text-[14px]">Resumen del día</h3>
        </CardHeader>
        <CardBody>
          <p className="m-0 text-ink-2 text-[13px]">
            12 citas atendidas, S/ 840 en ingresos y 2 clientes nuevos.
          </p>
        </CardBody>
        <CardFooter>Actualizado hace 5 min</CardFooter>
      </>
    ),
  },
  argTypes: {
    children: { control: false },
    className: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BodyOnly: Story = {
  args: {
    children: (
      <CardBody>
        <p className="m-0 text-[13px]">Barbero favorito de la semana: Diego Quispe (18 cortes).</p>
      </CardBody>
    ),
  },
};

export const WithActions: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <h3 className="m-0 font-semibold text-[14px]">Próxima cita</h3>
          <Button size="sm" variant="secondary" className="ml-auto">
            Reprogramar
          </Button>
        </CardHeader>
        <CardBody>
          <p className="m-0 font-semibold text-[13px]">Luis Ramírez · Corte + barba</p>
          <p className="m-0 text-ink-3 text-[12px]">Hoy 16:30 con Mateo Flores · S/ 45</p>
        </CardBody>
        <CardFooter>
          <span>Duración 50 min</span>
          <Button size="sm" className="ml-auto">
            Iniciar servicio
          </Button>
        </CardFooter>
      </>
    ),
  },
};

export const HeaderSlots: Story = {
  args: {
    children: (
      <>
        <CardHeader
          icon={<Wallet />}
          title="Caja de hoy"
          action={
            <Button size="sm" variant="secondary">
              Ver detalle
            </Button>
          }
        />
        <CardBody>
          <p className="m-0 text-[13px]">S/ 4 280 cobrados en 38 pedidos.</p>
        </CardBody>
      </>
    ),
  },
};
