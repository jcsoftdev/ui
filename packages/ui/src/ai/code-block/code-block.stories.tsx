import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "./code-block.js";

const TS = `// Total del día por barbero
interface Turno {
  barbero: string;
  precio: number;
}

export function totalPorBarbero(turnos: Turno[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const turno of turnos) {
    out[turno.barbero] = (out[turno.barbero] ?? 0) + turno.precio;
  }
  return out;
}`;

const meta = {
  title: "AI/CodeBlock",
  component: CodeBlock,
  tags: ["autodocs"],
  args: { code: TS, language: "ts", wrap: false },
  argTypes: {
    language: {
      control: "inline-radio",
      options: ["ts", "js", "json", "bash", "go", "sql", "texto"],
    },
    code: { control: "text" },
    filename: { control: "text" },
    wrap: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const Json: Story = {
  args: {
    language: "json",
    code: '{\n  "cliente": "Luis Paredes",\n  "servicio": "Corte + barba",\n  "precio": 55,\n  "confirmado": true,\n  "notas": null\n}',
  },
};

export const Bash: Story = {
  args: {
    language: "bash",
    code: "# Exportar la agenda\nexport FECHA=$(date +%F)\ncurl -s \"https://api.example.com/turnos?fecha=$FECHA\" | jq '.[] | .cliente'",
  },
};

export const Go: Story = {
  args: {
    language: "go",
    code: "func Total(precios []float64) float64 {\n\tvar suma float64\n\tfor _, p := range precios {\n\t\tsuma += p\n\t}\n\treturn suma\n}",
  },
};

export const Sql: Story = {
  args: {
    language: "sql",
    filename: "ingresos.sql",
    code: "SELECT barbero, SUM(precio) AS ingreso\nFROM turnos -- solo confirmados\nWHERE estado = 'confirmado'\nGROUP BY barbero\nORDER BY ingreso DESC;",
  },
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
