import type { Meta, StoryObj } from "@storybook/react-vite";
import { Markdown } from "./markdown.js";

const SAMPLE = `## Resumen de la semana

Esta semana **atendimos 142 clientes** y el servicio más pedido fue el *fade clásico*. Puedes revisar el detalle en [el reporte](https://example.com/reporte) o escribir a [soporte](mailto:soporte@example.com).

- Corte clásico: \`S/ 35\`
- Corte + barba: \`S/ 55\`
  - Incluye toalla caliente
- Perfilado: \`S/ 20\`

1. Confirmar turnos de mañana
2. Reponer cera y navajas

> Recuerda avisar a los clientes con turno pendiente.

| Barbero | Turnos | Ingreso |
| :-- | --: | --: |
| Diego | 38 | S/ 1 330 |
| Camila | 41 | S/ 1 535 |

\`\`\`sql
SELECT servicio, COUNT(*) AS total
FROM turnos
WHERE fecha >= '2026-06-01'
GROUP BY servicio;
\`\`\``;

const meta = {
  title: "AI/Markdown",
  component: Markdown,
  tags: ["autodocs"],
  args: { children: SAMPLE, streaming: false },
  argTypes: {
    children: { control: "text" },
    streaming: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const Streaming: Story = {
  args: {
    children: "Estoy revisando la agenda de hoy y encontré tres huecos libres",
    streaming: true,
  },
};

export const SafeByDefault: Story = {
  args: {
    children:
      'El HTML se muestra como texto: <img src=x onerror="alert(1)"> y <script>alert(1)</script>.\n\n[Enlace peligroso](javascript:alert(1)) queda como texto; [enlace seguro](https://example.com) sí funciona.',
  },
};

export const PresetBrutal: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
