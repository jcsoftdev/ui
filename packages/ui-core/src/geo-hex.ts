/**
 * Hex tile maps: one equal-size hexagon per region, placed by hand so that neighbours
 * on the grid are (roughly) neighbours on the ground. The layout is pointy-top with odd
 * rows pushed half a tile to the right ("odd-r"). Everything here is framework free.
 */

export interface HexTile {
  /** Region id, matched against the data (ISO 3166-2 for Peru: "PE-CUS"). */
  id: string;
  name: string;
  /** Two or three letters written on the tile. */
  code: string;
  row: number;
  col: number;
}

/**
 * Peru as 25 tiles (24 departments + Callao), north-west at the top left and the
 * south-east at the bottom right, with the Pacific coast down the left edge.
 * Lima is the department; the metropolitan area of the choropleth map belongs to it.
 */
export const PERU_HEX_TILES: readonly HexTile[] = [
  { id: "PE-TUM", name: "Tumbes", code: "TUM", row: 0, col: 0 },
  { id: "PE-LOR", name: "Loreto", code: "LOR", row: 0, col: 3 },
  { id: "PE-PIU", name: "Piura", code: "PIU", row: 1, col: 0 },
  { id: "PE-CAJ", name: "Cajamarca", code: "CAJ", row: 1, col: 1 },
  { id: "PE-AMA", name: "Amazonas", code: "AMA", row: 1, col: 2 },
  { id: "PE-SAM", name: "San Martín", code: "SAM", row: 1, col: 3 },
  { id: "PE-LAM", name: "Lambayeque", code: "LAM", row: 2, col: 1 },
  { id: "PE-LAL", name: "La Libertad", code: "LAL", row: 2, col: 2 },
  { id: "PE-HUC", name: "Huánuco", code: "HUC", row: 2, col: 3 },
  { id: "PE-UCA", name: "Ucayali", code: "UCA", row: 2, col: 4 },
  { id: "PE-ANC", name: "Áncash", code: "ANC", row: 3, col: 1 },
  { id: "PE-PAS", name: "Pasco", code: "PAS", row: 3, col: 2 },
  { id: "PE-JUN", name: "Junín", code: "JUN", row: 3, col: 3 },
  { id: "PE-CUS", name: "Cusco", code: "CUS", row: 3, col: 4 },
  { id: "PE-MDD", name: "Madre de Dios", code: "MDD", row: 3, col: 5 },
  { id: "PE-CAL", name: "Callao", code: "CAL", row: 4, col: 1 },
  { id: "PE-LIM", name: "Lima", code: "LIM", row: 4, col: 2 },
  { id: "PE-HUV", name: "Huancavelica", code: "HUV", row: 4, col: 3 },
  { id: "PE-AYA", name: "Ayacucho", code: "AYA", row: 4, col: 4 },
  { id: "PE-APU", name: "Apurímac", code: "APU", row: 4, col: 5 },
  { id: "PE-ICA", name: "Ica", code: "ICA", row: 5, col: 3 },
  { id: "PE-ARE", name: "Arequipa", code: "ARE", row: 5, col: 4 },
  { id: "PE-PUN", name: "Puno", code: "PUN", row: 5, col: 5 },
  { id: "PE-MOQ", name: "Moquegua", code: "MOQ", row: 6, col: 5 },
  { id: "PE-TAC", name: "Tacna", code: "TAC", row: 6, col: 6 },
];

const SQRT3 = Math.sqrt(3);

/** Horizontal tile units of a tile: columns, plus half a tile on odd rows. */
function unitsX(tile: Pick<HexTile, "row" | "col">): number {
  return tile.col + (tile.row % 2 === 1 ? 0.5 : 0);
}

export interface HexGrid {
  /** Distance from a tile's center to a corner, in pixels. */
  size: number;
  /** Center of every tile, in the order of the input. */
  centers: Array<[number, number]>;
  /** Pixel box taken by the tiles (the rest of the area is margin). */
  width: number;
  height: number;
  /** Where the box starts inside the area, so the grid is centered. */
  offsetX: number;
  offsetY: number;
}

/** Largest hexagons that fit `tiles` in a `width` x `height` area, centered. */
export function layoutHexGrid(
  tiles: readonly Pick<HexTile, "row" | "col">[],
  width: number,
  height: number,
): HexGrid {
  if (tiles.length === 0) {
    return { size: 0, centers: [], width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }
  const xs = tiles.map(unitsX);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rows = tiles.map((tile) => tile.row);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  // Width: (span + 1) tiles of SQRT3 * size. Height: rows * 1.5 * size plus the cap of a hexagon.
  const spanUnits = maxX - minX + 1;
  const spanRows = maxRow - minRow;
  const size = Math.max(0, Math.min(width / (spanUnits * SQRT3), height / (spanRows * 1.5 + 2)));
  const boxWidth = spanUnits * SQRT3 * size;
  const boxHeight = (spanRows * 1.5 + 2) * size;
  const offsetX = (width - boxWidth) / 2;
  const offsetY = (height - boxHeight) / 2;
  const centers = tiles.map((tile): [number, number] => [
    offsetX + (unitsX(tile) - minX + 0.5) * SQRT3 * size,
    offsetY + size + (tile.row - minRow) * 1.5 * size,
  ]);
  return { size, centers, width: boxWidth, height: boxHeight, offsetX, offsetY };
}

/** The six corners of a pointy-top hexagon as an SVG `points` value; `inset` shrinks it for the gap. */
export function hexPoints(cx: number, cy: number, size: number, inset = 0): string {
  const radius = Math.max(0, size - inset);
  const corners: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return corners.join(" ");
}

/** Index of the tile whose hexagon contains the point, or -1. */
export function hexAt(
  centers: ReadonlyArray<readonly [number, number]>,
  size: number,
  x: number,
  y: number,
): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  centers.forEach(([cx, cy], index) => {
    const distance = Math.hypot(x - cx, y - cy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  // The inscribed circle is a safe hit radius: it never reaches into the next tile.
  return best >= 0 && bestDistance <= (SQRT3 / 2) * size ? best : -1;
}

/** Ids of the tiles that share an edge with `tile` (odd-r offset neighbours). */
export function hexNeighbors(tile: HexTile, tiles: readonly HexTile[]): string[] {
  const odd = tile.row % 2 === 1;
  const around: Array<[number, number]> = [
    [tile.row, tile.col - 1],
    [tile.row, tile.col + 1],
    [tile.row - 1, tile.col + (odd ? 0 : -1)],
    [tile.row - 1, tile.col + (odd ? 1 : 0)],
    [tile.row + 1, tile.col + (odd ? 0 : -1)],
    [tile.row + 1, tile.col + (odd ? 1 : 0)],
  ];
  return tiles
    .filter((other) => around.some(([row, col]) => other.row === row && other.col === col))
    .map((other) => other.id);
}
