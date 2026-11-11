/// <reference types="@vitest/browser-playwright" />
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { CommandPalette, type CommandPaletteItem } from "./command-palette.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: CommandPaletteItem[] = [
  {
    id: "new",
    label: "New booking",
    group: "Actions",
    onSelect: () => undefined,
    intent: "action",
  },
  {
    id: "pay",
    label: "Charge",
    group: "Actions",
    onSelect: () => undefined,
    intent: "action",
    intentKey: "charge",
  },
  { id: "plain", label: "Plain", group: "Other", onSelect: () => undefined },
];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function mount(extra: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  await act(async () =>
    root.render(
      <CommandPalette
        open
        onClose={() => undefined}
        items={items}
        label="Search"
        placeholder="Search..."
        emptyLabel="Nothing"
        formatResultCount={(count) => `${count} results`}
        {...extra}
      />,
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
}

test("inputEnd renders after the input", async () => {
  await mount({ inputEnd: <button type="button">Mic</button> });
  const input = document.querySelector("input") as HTMLElement;
  const end = document.querySelector("[data-part='inputEnd']") as HTMLElement;
  expect(end.querySelector("button")?.textContent).toBe("Mic");
  expect(input.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("item intents land on the option", async () => {
  await mount();
  const options = [...document.querySelectorAll("[role='option']")];
  expect(options.map((option) => option.getAttribute("data-intent"))).toEqual([
    "action",
    "action",
    null,
  ]);
  expect(options.map((option) => option.getAttribute("data-intent-key"))).toEqual([
    "new",
    "charge",
    null,
  ]);
});
