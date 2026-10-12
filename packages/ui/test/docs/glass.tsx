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
