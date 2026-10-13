// Type-checks the examples in site/src/content/docs/docs/glass.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
import { Card, ItemCardGroup, type ItemCardGroupItem } from "@jcsoftdev/ui/containers";
import { useGlassLens } from "@jcsoftdev/ui/glass";
import { DialogContent } from "@jcsoftdev/ui/overlays";

// #region opt-in
export function OptIn({ items }: { items: ItemCardGroupItem[] }) {
  return (
    <>
      <Card material="glass-clear">Over a photo</Card>
      <ItemCardGroup classNames={{ list: "glass" }} items={items} />
    </>
  );
}

export function AlwaysOpaque() {
  return <DialogContent material="solid">Always opaque</DialogContent>;
}
// #endregion

// #region liquid
export function LiquidCards() {
  return (
    <>
      <Card material="liquid">Lensed along the rim</Card>
      <Card material="glass">Frosted, as before</Card>
    </>
  );
}
// #endregion

// #region crystal
export function Crystal() {
  return (
    <Card material={{ type: "liquid", preset: "crystal" }} className="rounded-full px-8 py-4">
      <span className="font-bold text-white [text-shadow:0_2px_10px_rgb(0_0_0/.5)]">Liquid Glass</span>
    </Card>
  );
}
// #endregion

// #region lens
export function Lens() {
  const ref = useGlassLens<HTMLDivElement>();
  return (
    <div ref={ref} className="liquid-clear rounded-dialog p-6">
      Bent edges
    </div>
  );
}
// #endregion

// #region liquid-options
export function ConfiguredLiquid() {
  return (
    <Card
      material={{
        type: "liquid",
        profile: "dome",
        frost: 4,
        refraction: 0.8,
        specular: { intensity: 1.2, angle: -60 },
        shadow: { opacity: 0.8, offsetY: 14 },
        interactive: "drag",
        motion: "jelly",
      }}
    >
      A drop of glass
    </Card>
  );
}
// #endregion
