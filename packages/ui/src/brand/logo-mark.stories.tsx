import type { Meta, StoryObj } from "@storybook/react-vite";
import { generateVariations, MARK_SHAPES, type MarkOptions } from "./generate.js";
import { GLYPHS } from "./glyphs.js";
import { LogoMark } from "./logo-mark.js";
import { BRAND_PALETTES } from "./palettes.js";

const meta = {
  title: "Foundations/LogoMark",
  component: LogoMark,
  tags: ["autodocs"],
  args: {
    name: "Barbería Don Lucho",
    tagline: "Corte y navaja desde 1998",
    shape: "shield",
    monogram: "glyph",
    glyph: "scissors",
    palette: "navaja",
    layout: "horizontal",
    fill: "solid",
    seed: 0,
    size: 360,
  },
  argTypes: {
    shape: { control: "inline-radio", options: MARK_SHAPES },
    monogram: { control: "inline-radio", options: ["initials", "glyph"] },
    glyph: { control: "select", options: GLYPHS.map((g) => g.id) },
    layout: { control: "inline-radio", options: ["icon", "horizontal", "stacked"] },
    fill: { control: "inline-radio", options: ["solid", "gradient", "outline"] },
    palette: { control: "select", options: BRAND_PALETTES.map((p) => p.id) },
    initialsCount: { control: "inline-radio", options: [1, 2, 3] },
    seed: { control: "number" },
    ring: { control: "boolean" },
    name: { control: "text" },
    tagline: { control: "text" },
    size: { control: "text" },
    wordmark: { control: false },
  },
} satisfies Meta<typeof LogoMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Stacked: Story = { args: { layout: "stacked", size: 240 } };

export const Initials: Story = {
  args: {
    monogram: "initials",
    initialsCount: 3,
    shape: "badge",
    palette: "bronce",
    layout: "icon",
    size: 160,
  },
};

export const Narrow: Story = {
  args: { size: "100%" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

const grid = "grid grid-cols-2 gap-density @md/gal:grid-cols-4 @2xl/gal:grid-cols-7";
const cell =
  "flex min-w-0 flex-col items-center gap-2 rounded-card bg-surface-sunken p-3 text-center shadow-card";

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cell}>
      <div className="w-full max-w-24">{children}</div>
      <span className="text-ink-3 text-meta">{label}</span>
    </div>
  );
}

export const Gallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const base: MarkOptions = { name: "Barbería Don Lucho", palette: "navaja", layout: "icon" };
    return (
      <div className="@container/gal flex flex-col gap-density-lg">
        <h4 className="font-semibold text-ink">Formas</h4>
        <div className={grid}>
          {MARK_SHAPES.map((shape) => (
            <Cell key={shape} label={shape}>
              <LogoMark {...base} shape={shape} monogram="initials" />
            </Cell>
          ))}
        </div>
        <h4 className="font-semibold text-ink">Símbolos</h4>
        <div className={grid}>
          {GLYPHS.map((g) => (
            <Cell key={g.id} label={g.label}>
              <LogoMark {...base} shape="squircle" monogram="glyph" glyph={g.id} palette="bronce" />
            </Cell>
          ))}
        </div>
        <h4 className="font-semibold text-ink">Paletas</h4>
        <div className={grid}>
          {BRAND_PALETTES.map((p, i) => (
            <Cell key={p.id} label={p.label}>
              <LogoMark
                {...base}
                shape="circle"
                monogram="initials"
                palette={p.id}
                fill={(["solid", "gradient", "outline"] as const)[i % 3]}
              />
            </Cell>
          ))}
        </div>
        <h4 className="font-semibold text-ink">Variaciones con semilla</h4>
        <div className={grid}>
          {generateVariations(base, 14).map((variant) => (
            <Cell key={variant.seed} label={`semilla ${variant.seed}`}>
              <LogoMark {...variant} />
            </Cell>
          ))}
        </div>
      </div>
    );
  },
};
