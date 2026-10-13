import { Avatar, Button, Chip, Progress, StatusPill, Switch } from "@jcsoftdev/ui/atoms";
import { AreaChart } from "@jcsoftdev/ui/charts";
import { Banner, Kpi } from "@jcsoftdev/ui/containers";
import { Input, Rating } from "@jcsoftdev/ui/forms";
import { Segmented, SegmentedItem, Tabs, TabsList, TabsTrigger } from "@jcsoftdev/ui/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@jcsoftdev/ui/overlays";
import { EmptyState } from "@jcsoftdev/ui/states";
import { TextShimmer } from "@jcsoftdev/ui/ai";
import { LogoMark } from "@jcsoftdev/ui/brand";
import { Calendar, Search, Sparkles } from "@jcsoftdev/ui/icons";
import type { ReactNode } from "react";
import { useMounted } from "./bento";
import { ingresos } from "./data";

export interface CatalogEntry {
  id: string;
  title: string;
  count: number;
  blurb: string;
  href: string;
}

const PREVIEW: Record<string, () => ReactNode> = {
  atoms: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" size="sm">
        Save
      </Button>
      <Chip tone="accent">Live</Chip>
      <StatusPill status="success" label="Open" />
      <Switch defaultChecked aria-label="Reminders" />
      <Avatar name="Ana Torres" size="md" />
    </div>
  ),
  forms: () => (
    <div className="grid gap-2">
      <Input aria-label="Search clients" placeholder="Search clients" />
      <Rating defaultValue={4} aria-label="Rating" />
    </div>
  ),
  navigation: () => (
    <div className="grid gap-2">
      <Segmented aria-label="Range" defaultValue="week">
        <SegmentedItem value="day">Day</SegmentedItem>
        <SegmentedItem value="week">Week</SegmentedItem>
        <SegmentedItem value="month">Month</SegmentedItem>
      </Segmented>
      <Tabs defaultValue="a">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a">Bookings</TabsTrigger>
          <TabsTrigger value="b">Clients</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  ),
  containers: () => (
    <div className="grid w-48 gap-2">
      <Kpi label="Revenue today" value="S/ 1 240" description="+12% vs. yesterday" />
      <Progress value={72} aria-label="Occupancy" />
    </div>
  ),
  overlays: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Reschedule</DropdownMenuItem>
        <DropdownMenuItem>Charge</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger">Cancel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  states: () => (
    <Banner tone="warning" title="You are offline">
      Changes sync when you reconnect.
    </Banner>
  ),
  ai: () => (
    <p className="m-0 text-body">
      <TextShimmer>Thinking about your schedule…</TextShimmer>
    </p>
  ),
  brand: () => (
    <div className="size-16">
      <LogoMark name="Barbería Lima" shape="shield" glyph="scissors" monogram="glyph" />
    </div>
  ),
};

const GLYPH: Record<string, ReactNode> = {
  calendar: <Calendar className="size-8 text-accent-ink" aria-hidden="true" />,
  palette: <Search className="size-8 text-accent-ink" aria-hidden="true" />,
  shell: <Sparkles className="size-8 text-accent-ink" aria-hidden="true" />,
};

function Chart() {
  const mounted = useMounted();
  if (!mounted) return <div className="h-20 w-56" />;
  const data = ingresos.slice(-14);
  return (
    <div className="h-20 w-56">
      <AreaChart
        height="fill"
        title="Revenue, last 14 days"
        categories={data.map((i) => i.fecha)}
        series={[{ id: "r", name: "Revenue", data: data.map((i) => i.ingresos) }]}
        valueFormat="currency"
        legend={false}
        labels={{ empty: "No data", category: "Day", value: "Revenue" }}
      />
    </div>
  );
}

export default function CatalogGrid({ entries }: { entries: CatalogEntry[] }) {
  return (
    <ul className="catalog" role="list">
      {entries.map((entry) => {
        const preview = entry.id === "charts" ? <Chart /> : PREVIEW[entry.id]?.();
        return (
          <li key={entry.id} className="catalog-card border-card shadow-card surface-card">
            <div className="catalog-preview" aria-hidden={preview ? undefined : true}>
              {preview ?? GLYPH[entry.id] ?? <span className="catalog-count">{entry.count}</span>}
            </div>
            <div className="catalog-body">
              <h3>
                <a href={entry.href}>{entry.title}</a>
                <span className="catalog-badge">{entry.count}</span>
              </h3>
              <p>{entry.blurb}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
