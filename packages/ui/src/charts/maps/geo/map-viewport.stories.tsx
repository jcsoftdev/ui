import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { ChartFrame } from "../../core/chart-frame.js";
import { seriesColor } from "../../core/palette.js";
import { ChartTooltip } from "../../core/tooltip.js";
import { useIndexNavigation } from "../../core/use-index-navigation.js";
import { peruMap } from "../data/peru/index.js";
import { resolveMapLabels } from "./map-labels.js";
import { MapViewport } from "./map-viewport.js";
import { defaultMapHeight, useMapGeometry } from "./use-map-geometry.js";
import { useMapView } from "./use-map-view.js";

const labels = resolveMapLabels({
  empty: "Sin datos del mapa",
  loading: "Cargando mapa",
  explore:
    "Departamentos del Perú. Usa las flechas para moverte, más y menos para acercar, cero para ver todo.",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  fit: "Ver todo el mapa",
  controls: "Zoom del mapa",
});

/** Departments where the barbershop has a branch. */
const branches = new Set(["Lima", "Arequipa", "Cusco", "La Libertad", "Piura"]);

interface StageProps {
  width: number;
  height: number;
  interactive: boolean;
  zoomable: boolean;
  names: boolean;
}

function Stage({ width, height, interactive, zoomable, names }: StageProps) {
  const geometry = useMapGeometry(peruMap, width, height);
  const controller = useMapView<SVGSVGElement>({
    width,
    height,
    content: geometry.bounds,
    gestures: zoomable,
    wheelZoom: "modifier",
    maxZoom: 16,
  });
  const nav = useIndexNavigation<HTMLDivElement>(geometry.features.length);
  const fills = useMemo(
    () =>
      geometry.features.map((feature) =>
        branches.has(feature.name) ? seriesColor(0) : "var(--surface-2)",
      ),
    [geometry.features],
  );
  const texts = useMemo(
    () => (names ? geometry.features.map((feature) => feature.name) : undefined),
    [geometry.features, names],
  );
  const current = nav.active == null ? null : (geometry.features[nav.active] ?? null);
  return (
    <MapViewport
      width={width}
      height={height}
      title="Sedes de la barbería por departamento"
      geometry={geometry}
      labels={labels}
      fills={fills}
      interactive={interactive}
      activeRegion={interactive ? nav.active : null}
      onRegionHover={nav.hover}
      onLeave={nav.leave}
      regionLabels={texts}
      controller={controller}
      zoomable={zoomable}
      containerRef={nav.ref}
      reveal={nav.active != null && !nav.pointer ? (geometry.anchors[nav.active] ?? null) : null}
      keyboard={
        interactive
          ? {
              count: geometry.features.length,
              active: nav.active,
              valueText: current
                ? `${current.name}: ${branches.has(current.name) ? "con sede" : "sin sede"}`
                : "Departamentos del Perú",
              onKeyDown: nav.sliderProps.onKeyDown,
              onFocus: nav.sliderProps.onFocus,
              onBlur: nav.sliderProps.onBlur,
            }
          : undefined
      }
      floating={({ toScreen }) => {
        if (!interactive || !current || nav.active == null) return null;
        const anchor = geometry.anchors[nav.active];
        const point = nav.pointer ?? (anchor ? asPoint(toScreen(anchor[0], anchor[1])) : null);
        if (!point) return null;
        return (
          <ChartTooltip
            x={point.x}
            y={point.y}
            containerWidth={width}
            title={current.name}
            rows={[
              {
                id: "sede",
                name: "Sede",
                value: branches.has(current.name) ? "Sí" : "No",
                color: fills[nav.active] ?? seriesColor(0),
              },
            ]}
          />
        );
      }}
    />
  );
}

function asPoint([x, y]: [number, number]) {
  return { x, y };
}

function MapDemo(props: Omit<StageProps, "width" | "height">) {
  return (
    <ChartFrame height={(width) => defaultMapHeight(peruMap, width)} labels={labels}>
      {(width, height) => <Stage width={width} height={height} {...props} />}
    </ChartFrame>
  );
}

const meta = {
  title: "Charts/Primitives/MapViewport",
  component: MapDemo,
  tags: ["autodocs"],
  args: { interactive: true, zoomable: true, names: false },
  argTypes: {
    interactive: { control: "boolean" },
    zoomable: { control: "boolean" },
    names: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="@container w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MapDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shared stage of every map: Peru with branch departments filled, zoom buttons and keyboard. */
export const Default: Story = {};

export const WithRegionNames: Story = { args: { names: true } };

/** A plain base map: no hover, no zoom controls. */
export const StaticBaseMap: Story = { args: { interactive: false, zoomable: false } };
