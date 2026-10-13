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

const setup = async (attrs = "") => {
  const host = mount(
    `<div style="width:400px"><ui-test-bars label="Weekly sales" height="160" locale="en-US">
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
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    // Placed against the button in the same task it opened, never at the page corner first.
    const popup = (document.querySelector("[role=menu]") as HTMLElement).getBoundingClientRect();
    expect(popup.top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom);
    await wait(30);
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

  it("quotes any field with a separator, quote, line break or tab, and keeps plain numbers plain", async () => {
    const { snapshotCsv } = await import("../src/internal/chart-export.ts");
    const csv = snapshotCsv({
      title: "t",
      categoryHeader: "Name",
      categories: ["a;b", "-5", "+1.5e3", "-x", "tab\there", "line\nbreak", "@cmd", "\r"],
      series: [{ id: "a", name: "A", color: "red", values: [1, 2, 3, 4, 5, 6, 7, 8], text: [] }],
    });
    const rows = csv.split("\r\n");
    expect(rows[1]).toBe('"a;b",1');
    expect(rows[2]).toBe("-5,2"); // a numeric string is not a formula: no apostrophe
    expect(rows[3]).toBe("+1.5e3,3");
    expect(rows[4]).toBe("'-x,4"); // text that starts like a formula is neutralized
    expect(rows[5]).toBe('"tab\there",5');
    expect(csv).toContain('"line\nbreak",6');
    expect(csv).toContain("'@cmd,7");
  });

  it("strips focus and ARIA wiring, takes the background from the chart's container, reports dropped images", async () => {
    const host = mount(
      `<div style="width:400px;background:rgb(10, 20, 30)"><ui-test-bars label="Weekly sales" height="160" locale="en-US"></ui-test-bars></div>`,
    );
    await frame();
    await wait(60);
    const chart = host.querySelector("ui-test-bars") as HTMLElement & {
      exportSvgs(): SVGSVGElement[];
    };
    const drawing = chart.exportSvgs()[0] as SVGSVGElement;
    drawing.append(
      Object.assign(document.createElementNS("http://www.w3.org/2000/svg", "image"), {}),
    );
    const img = drawing.lastElementChild as SVGElement;
    img.setAttribute("href", "https://example.com/logo.png");
    const tools = await import("../src/internal/chart-export.ts");
    const background = tools.backgroundOf(chart);
    expect(background).toBe("rgb(10, 20, 30)");
    const out = tools.serializeSvg(drawing, { background });
    expect(out.dropped).toEqual(["https://example.com/logo.png"]);
    expect(out.markup).not.toContain("<image");
    expect(out.markup).not.toMatch(/tabindex|role=|aria-/);
    expect(out.markup).toContain('fill="rgb(10, 20, 30)"');
    // The live chart is untouched.
    expect(drawing.getAttribute("role")).toBe("group");
    expect(drawing.querySelector("[tabindex]")).not.toBeNull();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = "";
    defineChartExportMenu();
    const h2 = mount(
      `<div style="width:400px"><ui-test-bars label="Weekly sales" height="160" locale="en-US"><ui-chart-export-menu></ui-chart-export-menu></ui-test-bars></div>`,
    );
    await frame();
    await wait(60);
    const c2 = h2.querySelector("ui-test-bars") as HTMLElement & { exportSvgs(): SVGSVGElement[] };
    const extra = document.createElementNS("http://www.w3.org/2000/svg", "image");
    extra.setAttribute("href", "https://example.com/a.png");
    c2.exportSvgs()[0]?.append(extra);
    const events: Array<{ dropped: string[] }> = [];
    const menu = h2.querySelector("ui-chart-export-menu") as HTMLElement;
    menu.addEventListener("export", (e) => events.push((e as CustomEvent).detail));
    (menu.querySelector("[data-format=svg]") as HTMLButtonElement).click();
    expect(await until(() => events.length === 1)).toBe(true);
    expect(events[0]?.dropped).toEqual(["https://example.com/a.png"]);
    expect(warn).toHaveBeenCalled();
  });
});
