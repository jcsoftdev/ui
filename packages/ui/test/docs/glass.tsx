// Type-checks the examples in site/src/content/docs/docs/glass.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
import { Card, ItemCardGroup, type ItemCardGroupItem } from "@jcsoftdev/ui/containers";
import { useGlassRefraction } from "@jcsoftdev/ui/glass";
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

// #region refraction
export function Lens() {
  const ref = useGlassRefraction<HTMLDivElement>();
  return (
    <div ref={ref} className="glass-clear rounded-dialog p-6">
      Bent edges
    </div>
  );
}
// #endregion
