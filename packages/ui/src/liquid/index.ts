// The declarative Liquid Glass API: `<LiquidGlass />` turns the lens on for a page, and
// `liquidStyle()` with the presets configures a surface. This entry holds no static import of the
// lens engine: `<LiquidGlass />` fetches it as a lazy chunk the first time a surface needs it, so a
// bundler that splits by file (esbuild) keeps the engine out of the first load too. The imperative
// engine and the maps live in `@jcsoftdev/ui/glass`.
export { LiquidGlass, startLiquidGlass } from "../glass/liquid-glass.js";
export {
  LIQUID_DEFAULTS,
  LIQUID_MOTIONS,
  LIQUID_PRESET_CLEAR,
  LIQUID_PRESET_CRYSTAL,
  LIQUID_PRESET_REGULAR,
  LIQUID_PRESET_THICK,
  LIQUID_PRESETS,
  type LiquidGlassOptions,
  type LiquidInteractive,
  type LiquidMotion,
  type LiquidPresetName,
  type LiquidProfile,
  liquidStyle,
  liquidVars,
  mergeLiquid,
} from "../glass/liquid-options.js";
export { supportsBackdropRefraction } from "../glass/support.js";
