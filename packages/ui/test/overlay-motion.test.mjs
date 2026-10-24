// Overlay motion contract: every overlay surface takes its enter/exit classes from one module, the
// exit is keyed on the primitives' `data-state="closed"` (so `usePresence` keeps the node mounted
// while it plays), anchored surfaces grow from the popper's transform origin, and reduced motion
// drops the transition.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const src = join(import.meta.dirname, "../src");
const read = (path) => readFileSync(join(src, path), "utf8");
const motion = read("utils/overlay-motion.ts");

const constant = (name) => {
  const match = motion.match(new RegExp(`export const ${name} =\\s*"([^"]+)"`));
  assert.ok(match, `${name} is a literal string Tailwind can scan`);
  return match[1].split(/\s+/);
};

test("each motion recipe has an enter, an exit on data-state=closed and a reduced-motion fallback", () => {
  for (const name of ["POPPER_MOTION", "OVERLAY_MOTION", "DIALOG_MOTION", "DRAWER_MOTION"]) {
    const classes = constant(name);
    assert.ok(
      classes.some((c) => c.startsWith("starting:")),
      `${name} enter`,
    );
    assert.ok(
      classes.some((c) => c.startsWith("data-[state=closed]:")),
      `${name} exit`,
    );
    assert.ok(classes.includes("motion-reduce:transition-none"), `${name} reduced motion`);
    assert.ok(classes.includes("duration-(--motion-duration)"), `${name} uses the motion token`);
  }
  const popper = constant("POPPER_MOTION");
  assert.ok(popper.includes("origin-(--ui-popper-transform-origin)"));
  for (const side of ["top", "right", "bottom", "left"])
    assert.ok(
      popper.some((c) => c.startsWith(`starting:data-[side=${side}]:`)),
      side,
    );
  assert.ok(constant("ITEM_MOTION").includes("transition-colors"));
});

test("every overlay surface uses the shared recipes", () => {
  const uses = {
    "overlays/dropdown-menu/dropdown-menu.tsx": ["POPPER_MOTION", "ITEM_MOTION"],
    "overlays/context-menu/context-menu.tsx": ["POPPER_MOTION", "ITEM_MOTION"],
    "overlays/popover/popover.tsx": ["POPPER_MOTION"],
    "overlays/tooltip/tooltip.tsx": ["POPPER_MOTION"],
    "overlays/hover-card/hover-card.tsx": ["POPPER_MOTION"],
    "forms/internal/listbox-items.tsx": ["POPPER_MOTION", "ITEM_MOTION"],
    "overlays/dialog/dialog.tsx": ["OVERLAY_MOTION", "DIALOG_MOTION"],
    "overlays/alert-dialog/alert-dialog.tsx": ["OVERLAY_MOTION", "DIALOG_MOTION"],
    "overlays/drawer/drawer.tsx": ["OVERLAY_MOTION", "DRAWER_MOTION"],
  };
  for (const [file, names] of Object.entries(uses)) {
    const source = read(file);
    for (const name of names) {
      const count = source.split(name).length - 1;
      assert.ok(count >= 2, `${file} imports and applies ${name}`);
    }
  }
});
