import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
import { describeFilter, emptyGroup, type FilterGroup } from "./filter-builder.js";
import { FilterBuilder } from "./filter-builder-editor.js";
import { DEFAULT_DATA_GRID_LABELS } from "./labels.js";
import { distinctValues } from "./model.js";

const initial: FilterGroup = {
  type: "group",
  id: "root",
  logic: "and",
  children: [
    { type: "condition", id: "c-estado", columnId: "estado", operator: "equals", value: "Pagado" },
    {
      type: "group",
      id: "g-or",
      logic: "or",
      children: [
        {
          type: "condition",
          id: "c-barbero",
          columnId: "barbero",
          operator: "equals",
          value: "Ana",
        },
        { type: "condition", id: "c-total", columnId: "total", operator: "gte", value: "50" },
      ],
    },
  ],
};

function Demo({ start }: { start: FilterGroup }) {
  const [value, setValue] = useState(start);
  const text = describeFilter(value, ventaColumns, {
    and: DEFAULT_DATA_GRID_LABELS.filterAnd,
    or: DEFAULT_DATA_GRID_LABELS.filterOr,
    operators: DEFAULT_DATA_GRID_LABELS.operators,
  });
  return (
    <div className="grid gap-3">
      <FilterBuilder<Venta>
        columns={ventaColumns}
        value={value}
        onChange={setValue}
        valuesOf={(id) => {
          const column = ventaColumns.find((c) => c.id === id);
          return column ? distinctValues(ventas, column) : [];
        }}
      />
      <p className="m-0 border-line border-t pt-2 text-[12.5px] text-ink-3">
        {text ? `Filtro: ${text}` : "Sin filtro activo."}
      </p>
    </div>
  );
}

const meta = {
  title: "Containers/DataGrid/FilterBuilder",
  component: FilterBuilder,
  tags: ["autodocs"],
  args: { columns: ventaColumns as never, value: initial, onChange: () => {} },
  argTypes: {
    columns: { control: false },
    value: { control: false },
    onChange: { control: false },
    valuesOf: { control: false },
    labels: { control: false },
  },
} satisfies Meta<typeof FilterBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nested AND / OR groups over the ventas columns. */
export const Default: Story = { render: () => <Demo start={initial} /> };

export const Empty: Story = { render: () => <Demo start={emptyGroup("and", "root")} /> };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  render: () => <Demo start={initial} />,
};
