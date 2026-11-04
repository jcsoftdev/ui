import { renderToStaticMarkup } from "react-dom/server";
import { ElapsedTime } from "../../src/atoms/elapsed-time/elapsed-time.js";
import { UiStringsProvider } from "../../src/i18n/index.js";
import { TableGlyph } from "../../src/atoms/table-glyph/table-glyph.js";
import { FloorPlan } from "../../src/containers/floor-plan/floor-plan.js";
export { formatClock, isoDuration, readElapsed, toneFor } from "../../src/atoms/elapsed-time/model.js";
export {
  getTickerSnapshot,
  subscribeTicker,
  tickerListenerCount,
} from "../../src/atoms/elapsed-time/ticker.js";
export {
  glyphLayout,
  rectSideCounts,
  squareSideCounts,
} from "../../src/atoms/table-glyph/layout.js";
export {
  groupOutlines,
  labelPlacement,
} from "../../src/containers/floor-plan/model.js";

const items = [
  { id: "t1", x: 1, y: 1, width: 4, height: 4, shape: "round", seats: 4, occupied: 2, label: "T1", statusLabel: "Seated", tone: "success", pattern: "soft" },
  { id: "t2", x: 5, y: 1, width: 1, height: 1, shape: "square", seats: 2, label: "T2", ring: "late", pattern: "dashed" },
  { id: "t3", x: 7, y: 1, width: 1, height: 1, shape: "square", seats: 2, label: "T3", groupId: "g", pattern: "strong" },
  { id: "t4", x: 8, y: 1, width: 1, height: 1, shape: "square", seats: 2, label: "T4", groupId: "g" },
];
const landmarks = [{ id: "l1", kind: "stairs", label: "Stairs", x: 0, y: 6, width: 2, height: 2 }];

const since = (minutes) => new Date(Date.now() - minutes * 60000 - 5000);

export const html = {
  glyph: (props) => renderToStaticMarkup(<TableGlyph {...props} />),
  plan: (props = {}) =>
    renderToStaticMarkup(
      <FloorPlan width={12} height={8} items={items} landmarks={landmarks} {...props} />,
    ),
  planEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <FloorPlan width={12} height={8} items={items} />
      </UiStringsProvider>,
    ),
  elapsed: (props, minutes = 12) =>
    renderToStaticMarkup(<ElapsedTime since={since(minutes)} {...props} />),
  elapsedEs: (minutes = 5) =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <ElapsedTime since={since(minutes)} />
      </UiStringsProvider>,
    ),
  countdown: (props) =>
    renderToStaticMarkup(
      <ElapsedTime since={new Date()} countdownTo={new Date(Date.now() + 5 * 60000 + 5000)} {...props} />,
    ),
};
