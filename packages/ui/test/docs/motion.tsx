// Type-checks the examples in site/src/content/docs/docs/motion.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
import { Button } from "@jcsoftdev/ui/atoms";
import { Card, Kpi } from "@jcsoftdev/ui/containers";
import {
  CountUp,
  CrossFade,
  MotionStyles,
  Presence,
  Reveal,
  Stagger,
  useHighlightRow,
} from "@jcsoftdev/ui/motion";
import { useState } from "react";

interface Student {
  id: string;
  name: string;
  average: number;
}
declare function approve(id: string): Promise<void>;

// #region reveal
export function Welcome() {
  return (
    <Reveal>
      <Card className="p-card">Welcome back. Three tasks are waiting for you.</Card>
    </Reveal>
  );
}
// #endregion

// #region stagger
export function DashboardCards({ titles }: { titles: string[] }) {
  return (
    <Stagger className="grid grid-cols-3 gap-6" inView>
      {titles.map((title) => (
        <Card key={title} className="p-card">
          {title}
        </Card>
      ))}
    </Stagger>
  );
}
// #endregion

// #region cross-fade
export function StudentDetail({ selected }: { selected: Student }) {
  return (
    <CrossFade contentKey={selected.id}>
      <Card className="grid gap-2 p-card">
        <h2>{selected.name}</h2>
        <Kpi label="Average" value={<CountUp value={selected.average} />} />
      </Card>
    </CrossFade>
  );
}
// #endregion

// #region presence
export function Hint() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen((value) => !value)}>Show the hint</Button>
      <Presence present={open}>
        <p>Grades are published every Friday.</p>
      </Presence>
    </>
  );
}
// #endregion

// #region count-up
const soles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

export function Revenue({ total }: { total: number }) {
  return <Kpi card label="Tuition collected" value={<CountUp value={total} formatter={soles} />} />;
}
// #endregion

// #region highlight-row
export function Applicants({ rows }: { rows: Student[] }) {
  const { highlight, rowProps } = useHighlightRow(rows.map((row) => row.id));
  return (
    <>
      <MotionStyles />
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} {...rowProps(row.id)}>
              <td>{row.name}</td>
              <td>
                <Button onClick={() => approve(row.id).then(() => highlight(row.id))}>
                  Approve
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
// #endregion
