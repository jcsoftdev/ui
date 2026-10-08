import { BarChart } from "@jcsoftdev/ui/charts";
import { KpiGroup } from "@jcsoftdev/ui/containers";
import { Slider } from "@jcsoftdev/ui/forms";
import { useId, useState } from "react";
import { useMounted } from "./bento";
import { kpis } from "./data";

const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** The frame is resized, not the viewport: components answer to their container. */
export default function ResponsiveDemo() {
  const mounted = useMounted();
  const [width, setWidth] = useState(720);
  const label = useId();
  return (
    <div className="flex min-w-0 flex-col gap-density">
      <div className="flex items-center gap-density">
        <span id={label} className="shrink-0 text-ink-2 text-meta">
          Container width
        </span>
        <div className="max-w-md flex-1">
          <Slider
            aria-labelledby={label}
            min={280}
            max={960}
            step={10}
            value={width}
            onValueChange={setWidth}
            showValue
            formatValue={(v) => `${v}px`}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-card border-card p-card surface-2">
        <div className="mx-auto max-w-full" style={{ width }}>
          <div className="@container/frame flex flex-col gap-density rounded-card border-card p-card shadow-card surface-card">
            <KpiGroup items={kpis} />
            <div className="h-48">
              {mounted ? (
                <BarChart
                  height="fill"
                  title="Citas por día"
                  categories={dias}
                  series={[{ id: "c", name: "Citas", data: [18, 24, 27, 33, 46, 58, 12] }]}
                  legend={false}
                  labels={{ empty: "Sin datos", category: "Día", value: "Citas" }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
