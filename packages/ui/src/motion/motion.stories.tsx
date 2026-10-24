import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { Button } from "../atoms/button/button.js";
import { Card } from "../containers/card/card.js";
import { Kpi } from "../containers/kpi/kpi.js";
import { CountUp } from "./count-up.js";
import { CrossFade } from "./cross-fade.js";
import { MotionStyles } from "./motion-styles.js";
import { Reveal, Stagger } from "./reveal.js";
import { useHighlightRow } from "./use-highlight-row.js";

const meta = {
  title: "Motion/Motion",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Remounts its children, so a client-side enter can be watched again. */
function Replay({ children }: { children: (run: number) => ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <div className="grid gap-4">
      <div>
        <Button size="sm" variant="secondary" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
      </div>
      <div key={run}>{children(run)}</div>
    </div>
  );
}

export const RevealOnMount: Story = {
  render: () => (
    <Replay>
      {() => (
        <Reveal>
          <Card className="max-w-sm p-card">Welcome back. Three tasks are waiting for you.</Card>
        </Reveal>
      )}
    </Replay>
  ),
};

const cards = ["Students", "Attendance", "Grades", "Payments", "Messages", "Calendar"];

export const StaggeredCards: Story = {
  render: () => (
    <Replay>
      {() => (
        <Stagger className="grid max-w-2xl grid-cols-3 gap-4">
          {cards.map((title) => (
            <Card key={title} className="p-card">
              {title}
            </Card>
          ))}
        </Stagger>
      )}
    </Replay>
  ),
};

const students = [
  { id: "s1", name: "Lucía Rojas", grade: "5th A", average: 17.4 },
  { id: "s2", name: "Mateo Quispe", grade: "5th A", average: 15.1 },
  { id: "s3", name: "Valeria Torres", grade: "5th B", average: 18.2 },
];

const average = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function ListDetailDemo() {
  const [selected, setSelected] = useState(students[0] ?? null);
  return (
    <div className="grid max-w-2xl grid-cols-[12rem_1fr] gap-6">
      <ul className="grid gap-1">
        {students.map((student) => (
          <li key={student.id}>
            <Button
              variant={student.id === selected?.id ? "primary" : "ghost"}
              aria-pressed={student.id === selected?.id}
              onClick={() => setSelected(student)}
            >
              {student.name}
            </Button>
          </li>
        ))}
      </ul>
      <CrossFade contentKey={selected?.id ?? "none"}>
        {selected ? (
          <Card className="grid gap-2 p-card">
            <h3 className="font-semibold">{selected.name}</h3>
            <p>{selected.grade}</p>
            <Kpi label="Average" value={<CountUp value={selected.average} formatter={average} />} />
          </Card>
        ) : null}
      </CrossFade>
    </div>
  );
}

export const CrossFadeListDetail: Story = { render: () => <ListDetailDemo /> };

const currency = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

function KpiDemo() {
  const [revenue, setRevenue] = useState(18420);
  return (
    <div className="grid max-w-md gap-4">
      <Kpi
        card
        label="Tuition collected"
        value={<CountUp value={revenue} formatter={currency} />}
      />
      <div>
        <Button size="sm" variant="secondary" onClick={() => setRevenue((n) => n + 1250)}>
          Record a payment
        </Button>
      </div>
    </div>
  );
}

export const CountUpInAKpi: Story = { render: () => <KpiDemo /> };

function HighlightDemo() {
  const [rows, setRows] = useState([
    { id: 1, name: "Lucía Rojas", status: "Pending" },
    { id: 2, name: "Mateo Quispe", status: "Pending" },
  ]);
  const { highlight, rowProps } = useHighlightRow(rows.map((row) => row.id));
  const approve = (id: number) => {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, status: "Approved" } : row)));
    highlight(id);
  };
  const add = () =>
    setRows((list) => [
      ...list,
      { id: list.length + 1, name: `Applicant ${list.length + 1}`, status: "Pending" },
    ]);
  return (
    <div className="grid max-w-lg gap-4">
      <MotionStyles />
      <div>
        <Button size="sm" variant="secondary" onClick={add}>
          Add applicant
        </Button>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Status</th>
            <th className="p-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} {...rowProps(row.id)}>
              <td className="p-2">{row.name}</td>
              <td className="p-2">{row.status}</td>
              <td className="p-2">
                <Button size="sm" variant="ghost" onClick={() => approve(row.id)}>
                  Approve
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const HighlightRows: Story = { render: () => <HighlightDemo /> };
