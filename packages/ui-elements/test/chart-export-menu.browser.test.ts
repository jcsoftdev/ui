import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartExportMenu } from "../src/chart-export-menu/chart-export-menu.ts";
import { defineTestBars } from "./chart-fixture.ts";
import { frame, mount, wait } from "./setup.ts";

const fetched = (pattern: RegExp) =>
  performance.getEntriesByType("resource").some((entry) => pattern.test(entry.name));
const until = async (test: () => boolean) => {
  for (let i = 0; i < 300 && !test(); i++) await wait(10);
  return test();
};

const downloads: Array<{ name: string; blob: Blob }> = [];
const blobAt = (index: number) => downloads[index]!.blob;

beforeAll(() => {
  defineTestBars();
  defineChartExportMenu();
});
beforeEach(() => {
  downloads.length = 0;
  const blobs = new Map<string, Blob>();
  const create = URL.createObjectURL.bind(URL);
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = create(blob as Blob);
    blobs.set(url, blob as Blob);
    return url;
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, blob: blobs.get(this.href) as Blob });
  });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// Low on the page: a stationary pointer at (0, 0) must not end up over the popup, where the menu
// would (correctly) move focus to the hovered area and make keyboard assertions racy.
const setup = async (attrs = "") => {
  const host = mount(
    `<div style="width:400px;margin-top:300px"><ui-test-bars label="Weekly sales" height="160" locale="en-US">
       <ui-chart-export-menu ${attrs}></ui-chart-export-menu></ui-test-bars></div>`,
  );
  await frame();
  await wait(60);
  const menu = host.querySelector("ui-chart-export-menu") as HTMLElement;
  const trigger = menu.querySelector("[data-ui-part=trigger]") as HTMLButtonElement;
  const item = (format: string) =>
    menu.querySelector<HTMLButtonElement>(`[data-format=${format}]`) as HTMLButtonElement;
  return { menu, trigger, item };
};
const text = (blob: Blob) => blob.text();

describe("ui-chart-export-menu", () => {
  it("is a menu button: opens from the keyboard, moves with arrows, closes with Escape and returns focus", async () => {
    const { trigger, item } = await setup();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const trace: string[] = [];
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, ...args) {
      trace.push(
        `${this.tagName}[${this.dataset.format ?? this.dataset.uiPart ?? ""}] ${new Error().stack?.split("\n").slice(2, 5).join(" | ")}`,
      );
      return focus.apply(this, args);
    };
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await wait(30);
    HTMLElement.prototype.focus = focus;
    if (document.activeElement !== item("svg"))
      console.log(
        "FOCUS TRACE\n" + trace.join("\n"),
        document.activeElement?.outerHTML.slice(0, 100),
      );
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(item("svg"));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(item("png"));
    await userEvent.keyboard("{Escape}");
    expect(await until(() => trigger.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(await until(() => document.activeElement === trigger)).toBe(true);
  });

  it("formats limits the items, and texts are replaceable", async () => {
    const { menu } = await setup('formats="csv xlsx"');
    expect([...menu.querySelectorAll("[role=menuitem]")].map((i) => i.textContent)).toEqual([
      "CSV",
      "XLSX",
    ]);
  });

  it("fetches no export code until the first export, and no XLSX writer until XLSX is chosen", async () => {
    const { trigger, item } = await setup();
    await wait(100);
    expect(fetched(/chart-export\./)).toBe(false);
    expect(fetched(/xlsx/)).toBe(false);

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}"); // svg, png, csv
    expect(await until(() => downloads.length === 1)).toBe(true);
    expect(downloads[0]?.name).toBe("weekly-sales.csv");
    expect(fetched(/chart-export\./)).toBe(true);
    expect(fetched(/xlsx/)).toBe(false);

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    item("xlsx").click();
    expect(await until(() => downloads.length === 2)).toBe(true);
    expect(fetched(/xlsx/)).toBe(true);
    expect(downloads[1]?.name).toBe("weekly-sales.xlsx");
    const head = new Uint8Array(await blobAt(1).slice(0, 2).arrayBuffer());
    expect([...head]).toEqual([0x50, 0x4b]); // "PK": a real zip container
  });

  it("exports the data as CSV with raw numbers, and the drawing as SVG and PNG", async () => {
    const { trigger, item } = await setup();
    const open = async () => {
      trigger.focus();
      await userEvent.keyboard("{Enter}");
    };
    await open();
    item("csv").click();
    expect(await until(() => downloads.length === 1)).toBe(true);
    const csv = await text(blobAt(0));
    expect(csv.startsWith("Day,Sales\r\nMon,1200.5\r\nTue,800\r\n")).toBe(true);
    const bom = new Uint8Array(await blobAt(0).slice(0, 3).arrayBuffer());
    expect([...bom]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so spreadsheets read accents

    await open();
    item("svg").click();
    expect(await until(() => downloads.length === 2)).toBe(true);
    const markup = await text(blobAt(1));
    expect(markup).toContain("<svg");
    expect(markup).toContain('width="400"');
    expect(markup).not.toContain("var(--"); // paint is baked in, the file stands alone

    await open();
    item("png").click();
    expect(await until(() => downloads.length === 3)).toBe(true);
    expect(downloads[2]?.name).toBe("weekly-sales.png");
    expect(downloads[2]?.blob.type).toBe("image/png");
  });

  it("neutralizes spreadsheet formulas in CSV text", async () => {
    const { snapshotCsv } = await import("../src/internal/chart-export.ts");
    const csv = snapshotCsv({
      title: "t",
      categoryHeader: "Name",
      categories: ["=HYPERLINK(1)", 'say "hi", ok'],
      series: [{ id: "a", name: "A", color: "red", values: [1, 2], text: ["1", "2"] }],
    });
    expect(csv).toBe('Name,A\r\n\'=HYPERLINK(1),1\r\n"say ""hi"", ok",2\r\n');
  });
});
