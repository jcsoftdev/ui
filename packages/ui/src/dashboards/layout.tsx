import type { Decorator } from "@storybook/react-vite";

export {
  CardGrid,
  ChartCard,
  type ChartCardProps,
  DashboardPage,
  KpiRow,
  TableCard,
} from "../containers/dashboard/index.js";

/** Container-width frames for the `Narrow` (320) and `Tablet` (768) variants. */
export const narrowFrame: Decorator = (Story) => (
  <div className="@container/page w-[320px] max-w-full">
    <Story />
  </div>
);

export const tabletFrame: Decorator = (Story) => (
  <div className="@container/page w-[768px] max-w-full">
    <Story />
  </div>
);

export const NARROW_NOTE =
  "Container of 320 px: Cols collapse to one column, KPIs go two per row and every chart adapts to its card.";
export const TABLET_NOTE =
  "Container of 768 px: cards pair up and Cols stay in one column (they split from 940 px of container).";
