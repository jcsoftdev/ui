import { Chip } from "@jcsoftdev/ui/atoms";
import { LogoForge } from "@jcsoftdev/ui/brand";
import { Tile, TileSkeleton, useMounted } from "./bento";

export default function LogoForgeTile() {
  const mounted = useMounted();
  return (
    <Tile
      title="Logo Forge"
      subtitle="Generate and export a brand mark"
      cols={2}
      rows={4}
      index={5}
      aside={<Chip tone="accent">SVG / PNG</Chip>}
    >
      <div className="h-full overflow-auto">
        {mounted ? <LogoForge /> : <TileSkeleton label="logo forge" />}
      </div>
    </Tile>
  );
}
