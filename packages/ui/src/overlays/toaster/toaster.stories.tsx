import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Toaster, toast } from "./toaster.js";

const meta = {
  title: "Overlays/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  args: { position: "bottom-center", duration: 6000, visibleToasts: 2 },
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    },
    duration: { control: "number" },
    visibleToasts: { control: "number" },
    toastOptions: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button onClick={() => toast("Cita agendada para Luis Ramírez, sábado 11:30")}>
        Agendar cita
      </Button>
    </>
  ),
};

export const WithUndoAction: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button
        variant="secondary"
        onClick={() =>
          toast("Cita de Marco Salas anulada", {
            action: { label: "Deshacer", onClick: () => toast("Cita restaurada") },
          })
        }
      >
        Anular cita
      </Button>
    </>
  ),
};

export const OpenByDefault: Story = {
  args: { duration: Number.POSITIVE_INFINITY },
  render: (args) => {
    // Rendered once on mount so docs show a visible toast.
    setTimeout(() => {
      toast.dismiss();
      toast("Pago de S/ 45 registrado con Yape", {
        action: { label: "Ver recibo", onClick: () => undefined },
      });
    }, 0);
    return <Toaster {...args} />;
  },
};

export const TopRightStack: Story = {
  args: { position: "top-right", visibleToasts: 3 },
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button
        variant="secondary"
        onClick={() => {
          toast("Stock bajo: Pomada mate (9 u.)");
          toast("Nuevo cliente: José Carrasco");
          toast("Cobro de S/ 25 completado");
        }}
      >
        Lanzar 3 avisos
      </Button>
    </>
  ),
};
