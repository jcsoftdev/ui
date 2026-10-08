import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategorySlider, useCategoryExplorer } from "./category-explorer.js";
import { ChartTooltip } from "./tooltip.js";

const services = [
  { name: "Corte clásico", sales: 38, price: "S/ 35" },
  { name: "Degradado", sales: 31, price: "S/ 45" },
  { name: "Barba", sales: 27, price: "S/ 25" },
  { name: "Corte + barba", sales: 22, price: "S/ 60" },
  { name: "Color", sales: 9, price: "S/ 120" },
];

const WIDTH = 420;
const HEIGHT = 180;
const SLOT = WIDTH / services.length;

function Demo() {
  const explorer = useCategoryExplorer({
    count: services.length,
    anchor: (index) => ({ x: index * SLOT + SLOT / 2, y: HEIGHT / 2 }),
  });
  const active = explorer.active == null ? null : services[explorer.active];
  return (
    <div className="relative" style={{ width: WIDTH, maxWidth: "100%" }}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="Servicios más vendidos"
        className="max-w-full"
        {...explorer.pointerProps}
      >
        <title>Servicios más vendidos</title>
        {services.map((service, index) => {
          const barHeight = (service.sales / 38) * (HEIGHT - 16);
          return (
            <rect
              key={service.name}
              data-category={index}
              x={index * SLOT + SLOT * 0.15}
              y={HEIGHT - barHeight}
              width={SLOT * 0.7}
              height={barHeight}
              rx={6}
              style={{
                fill: "var(--chart-cat-1)",
                opacity: explorer.active == null || explorer.active === index ? 1 : 0.35,
              }}
            />
          );
        })}
      </svg>
      <CategorySlider
        explorer={explorer}
        label="Recorrer servicios con las flechas"
        count={services.length}
        valueText={active ? `${active.name}: ${active.sales} ventas` : "Sin selección"}
      />
      {active && explorer.position ? (
        <ChartTooltip
          x={explorer.position.x}
          y={explorer.position.y}
          containerWidth={WIDTH}
          title={active.name}
          rows={[
            {
              id: "ventas",
              name: "Ventas",
              value: String(active.sales),
              color: "var(--chart-cat-1)",
            },
            { id: "precio", name: "Precio", value: active.price, color: "var(--chart-cat-2)" },
          ]}
        />
      ) : null}
    </div>
  );
}

const meta = {
  title: "Charts/Primitives/CategorySlider",
  component: CategorySlider,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Capa de teclado sobre un dibujo con categorías. Enfoca la gráfica y usa las flechas, Inicio, Fin y Escape; el puntero sigue llegando a las marcas de abajo.",
      },
    },
  },
  args: {
    // Replaced by the render function, which owns the explorer state.
    explorer: {} as never,
    label: "Recorrer servicios con las flechas",
    count: services.length,
    valueText: "",
  },
  argTypes: {
    explorer: { control: false },
    label: { control: "text" },
    count: { control: false },
    valueText: { control: "text" },
  },
} satisfies Meta<typeof CategorySlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <Demo /> };
