// The ui-core / React chart math the geometry, sampling, colour and hit-test fixtures need. Path, stack, downsample, palette, colour
// scale, brush and pan-zoom come from ui-core (pinned to the React kit value for value); the hit-test indexes are React-only.
export * from "../../../../../ui-core/src/chart/path.ts";
export * from "../../../../../ui-core/src/chart/downsample.ts";
export * from "../../../../../ui-core/src/chart/stack.ts";
export * from "../../../../../ui-core/src/chart/palette.ts";
export * from "../../../../../ui-core/src/chart/color-scale.ts";
export * from "../../../../../ui-core/src/chart/brush.ts";
export * from "../../../../../ui-core/src/chart/pan-zoom.ts";
export { boxAt, GUTTER_SNAP } from "../../../../../ui/src/charts/core/nearest.ts";
export { createPointIndex } from "../../../../../ui/src/charts/core/distribution/point-index.ts";
