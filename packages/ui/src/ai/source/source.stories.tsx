import type { Meta, StoryObj } from "@storybook/react-vite";
import { Source } from "./source.js";

const meta = {
  title: "AI/Source",
  component: Source,
  tags: ["autodocs"],
  args: {
    index: 1,
    title: "Cuidado de la barba: guía para principiantes",
    url: "https://www.barberia-ejemplo.pe/guias/cuidado-de-la-barba",
    snippet:
      "Lava la barba dos o tres veces por semana, aplica aceite en pocas gotas y peina en la dirección del crecimiento.",
  },
  argTypes: {
    index: { control: "number" },
    title: { control: "text" },
    url: { control: "text" },
    snippet: { control: "text" },
  },
} satisfies Meta<typeof Source>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div className="pb-40">
        <Story />
      </div>
    ),
  ],
};

export const Group: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-density-sm pb-40">
      <Source {...args} />
      <Source
        index={2}
        title="Tendencias de corte 2026"
        url="https://tendencias.example.org/cortes-2026"
        snippet="El fade bajo con textura arriba sigue siendo el más pedido."
      />
      <Source
        index={3}
        title="Enlace no seguro"
        url="javascript:alert(1)"
        snippet="Un protocolo no permitido se muestra como chip sin enlace."
      />
    </div>
  ),
};

export const Narrow: Story = {
  args: { url: "https://subdominio.muy-largo.barberia-ejemplo.pe/guias/cuidado" },
  decorators: [
    (Story) => (
      <div className="w-[320px] pb-40">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card pb-40">
        <Story />
      </div>
    ),
  ],
};
