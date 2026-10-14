// The calendar helpers of the cartesian charts, loaded on demand: only a chart whose categories are
// dates needs them, so the others never download this code.
import { dayOfMonth, formatDate, shortMonth, timeScale } from "@jcsoftdev/ui-core/chart/scale-time";

export const timeKit = { timeScale, formatDate, dayOfMonth, shortMonth };
export type TimeKit = typeof timeKit;
