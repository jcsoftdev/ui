import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { NativeSelect } from "../../forms/native-select/native-select.js";
import { FilterBar } from "./filter-bar.js";

const meta = {
  title: "Containers/FilterBar",
  component: FilterBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const statuses = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "overdue", label: "Vencidos" },
];

function Demo() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [grade, setGrade] = useState("");
  const chips = [
    ...(status
      ? [
          {
            id: "status",
            label: `Estado: ${statuses.find((s) => s.value === status)?.label}`,
            onRemove: () => setStatus(""),
          },
        ]
      : []),
    ...(grade ? [{ id: "grade", label: `Grado: ${grade}`, onRemove: () => setGrade("") }] : []),
    ...(search ? [{ id: "search", label: `“${search}”`, onRemove: () => setSearch("") }] : []),
  ];
  return (
    <FilterBar
      search={search}
      onSearchChange={setSearch}
      quickFilters={{
        label: "Estado",
        options: statuses,
        value: status,
        onValueChange: setStatus,
      }}
      activeFilters={chips}
      onClearAll={() => {
        setSearch("");
        setStatus("");
        setGrade("");
      }}
      resultCount={1240}
      actions={<Button size="sm">Exportar</Button>}
      labels={{
        search: "Buscar",
        filters: "Filtros",
        moreFilters: "Más filtros",
        clearAll: "Limpiar todo",
        removeFilter: "Quitar filtro {filter}",
        activeFilters: "Filtros activos",
        resultOne: "1 resultado",
        resultMany: "{count} resultados",
      }}
    >
      <NativeSelect
        aria-label="Grado"
        value={grade}
        onChange={(event) => setGrade(event.target.value)}
        options={[
          { value: "", label: "Todos los grados" },
          { value: "1º", label: "1º" },
          { value: "2º", label: "2º" },
        ]}
      />
    </FilterBar>
  );
}

/** Removing a chip or clearing all resets the filter it stands for. */
export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("list", { name: "Filtros activos" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Quitar filtro Estado: Pendientes" }));
    await expect(canvas.queryByRole("list", { name: "Filtros activos" })).toBeNull();
  },
};

export const SearchOnly: Story = { args: { resultCount: 1 } };

/** 320 px container: the quick chips and the extra filters fold into one Filters button. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => <Demo />,
};
