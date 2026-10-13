import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineCols } from "../src/cols/cols.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineCols();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const columns = (element: Element) =>
  getComputedStyle(element).gridTemplateColumns.split(" ").length;

const page = (width: number, inner: string) =>
  mount(
    `<div style="container:page / inline-size;width:${width}px"><ui-cols>${inner}<div>a</div><div>b</div></ui-cols></div>`,
  );

describe("ui-cols", () => {
  it("answers to the page container, not the viewport", () => {
    expect(columns(page(1200, "").querySelector("ui-cols")!)).toBe(2);
    document.body.innerHTML = "";
    expect(columns(page(900, "").querySelector("ui-cols")!)).toBe(1);
  });

  it("rail keeps a fixed rail and collapses at 1080px", () => {
    const wide = mount(
      `<div style="container:page / inline-size;width:1200px"><ui-cols variant="rail"><i></i><i></i></ui-cols></div>`,
    ).querySelector("ui-cols")!;
    expect(getComputedStyle(wide).gridTemplateColumns.split(" ")[1]).toBe("372px");
    document.body.innerHTML = "";
    const narrow = mount(
      `<div style="container:page / inline-size;width:1000px"><ui-cols variant="rail"><i></i><i></i></ui-cols></div>`,
    ).querySelector("ui-cols")!;
    expect(columns(narrow)).toBe(1);
  });

  it("without a page container the wide layout applies", () => {
    const cols = mount(`<ui-cols variant="half" style="width:400px"><i></i><i></i></ui-cols>`);
    expect(columns(cols.querySelector("ui-cols")!)).toBe(2);
  });

  it("wide-split stack spans its first child over two rows from 1500px", () => {
    defineCols();
    const host = mount(
      `<div style="container:page / inline-size;width:1600px"><ui-cols-stack wide-split><div>1</div><div>2</div></ui-cols-stack></div>`,
    );
    const stack = host.querySelector("ui-cols-stack")!;
    expect(getComputedStyle(stack).display).toBe("grid");
    expect(getComputedStyle(stack.firstElementChild!).gridRowStart).toBe("span 2");
  });
});
