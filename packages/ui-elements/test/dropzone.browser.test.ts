import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineDropzone, type UiDropzone } from "../src/dropzone/dropzone.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineDropzone();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const file = (name: string, type: string, size = 4) =>
  new File([new Uint8Array(size)], name, { type });

function transfer(...files: File[]) {
  const data = new DataTransfer();
  for (const item of files) data.items.add(item);
  return data;
}
const drop = (zone: UiDropzone, ...files: File[]) =>
  zone.dispatchEvent(
    new DragEvent("drop", { dataTransfer: transfer(...files), bubbles: true, cancelable: true }),
  );

describe("ui-dropzone", () => {
  it("names its browse button and describes it with the title and hint", async () => {
    mount(`<ui-dropzone label="Attachments" browse-label="Choose files">Drop files here
      <span slot="hint">PNG up to 2 MB</span></ui-dropzone>`);
    await frame();
    expect(await ax("group", "Attachments")).toBeTruthy();
    const button = await ax("button", "Choose files");
    expect(button).toBeTruthy();
  });

  it("only reacts to file drags and reflects the dragging state", () => {
    const host = mount(`<ui-dropzone>Drop</ui-dropzone>`);
    const zone = host.querySelector<UiDropzone>("ui-dropzone")!;
    const text = new DataTransfer();
    text.setData("text/plain", "hello");
    zone.dispatchEvent(
      new DragEvent("dragenter", { dataTransfer: text, bubbles: true, cancelable: true }),
    );
    expect(zone.hasAttribute("dragging")).toBe(false);
    zone.dispatchEvent(
      new DragEvent("dragenter", {
        dataTransfer: transfer(file("a.png", "image/png")),
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(zone.hasAttribute("dragging")).toBe(true);
    drop(zone, file("a.png", "image/png"));
    expect(zone.hasAttribute("dragging")).toBe(false);
  });

  it("validates type then size with ui-core, emitting files and reject", () => {
    const host = mount(`<ui-dropzone accept="image/*,.pdf" max-size="100">Drop</ui-dropzone>`);
    const zone = host.querySelector<UiDropzone>("ui-dropzone")!;
    const files = vi.fn();
    const reject = vi.fn();
    const change = vi.fn();
    zone.addEventListener("files", (event) =>
      files((event as CustomEvent).detail.files.map((f: File) => f.name)),
    );
    zone.addEventListener("reject", (event) =>
      reject(
        (event as CustomEvent).detail.rejections.map((r: { file: File; reason: string }) => [
          r.file.name,
          r.reason,
        ]),
      ),
    );
    zone.addEventListener("change", change);
    drop(
      zone,
      file("a.png", "image/png"),
      file("b.pdf", "application/pdf"),
      file("c.txt", "text/plain"),
      file("big.png", "image/png", 500),
    );
    expect(files).toHaveBeenCalledWith(["a.png", "b.pdf"]);
    expect(reject).toHaveBeenCalledWith([
      ["c.txt", "type"],
      ["big.png", "size"],
    ]);
    expect(change).toHaveBeenCalledTimes(1);
    expect(zone.files.map((f) => f.name)).toEqual(["a.png", "b.pdf"]);
  });

  it("takes the first file only when multiple is false", () => {
    const host = mount(`<ui-dropzone multiple="false">Drop</ui-dropzone>`);
    const zone = host.querySelector<UiDropzone>("ui-dropzone")!;
    drop(zone, file("a.png", "image/png"), file("b.png", "image/png"));
    expect(zone.files.map((f) => f.name)).toEqual(["a.png"]);
  });

  it("is form-associated: submits the files, replaces a batch, requires, resets, disables", () => {
    const host = mount(`<form><fieldset><ui-dropzone name="docs" required>Drop</ui-dropzone>
      </fieldset></form>`);
    const form = host.querySelector("form")!;
    const zone = host.querySelector<UiDropzone>("ui-dropzone")!;
    expect(zone.validity.valueMissing).toBe(true);
    drop(zone, file("a.png", "image/png"), file("b.png", "image/png"));
    expect(zone.checkValidity()).toBe(true);
    expect(new FormData(form).getAll("docs").map((f) => (f as File).name)).toEqual([
      "a.png",
      "b.png",
    ]);
    drop(zone, file("c.png", "image/png"));
    expect(new FormData(form).getAll("docs").map((f) => (f as File).name)).toEqual(["c.png"]);
    form.reset();
    expect(zone.files).toEqual([]);
    expect(new FormData(form).has("docs")).toBe(false);
    host.querySelector("fieldset")!.disabled = true;
    drop(zone, file("d.png", "image/png"));
    expect(zone.files).toEqual([]);
    expect(zone.shadowRoot!.querySelector("button")!.disabled).toBe(true);
  });
});
