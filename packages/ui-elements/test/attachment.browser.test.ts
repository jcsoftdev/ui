import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineAttachment, type UiAttachment } from "../src/attachment/attachment.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineAttachment();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const shadow = (el: Element) => el.shadowRoot as ShadowRoot;

describe("ui-attachment", () => {
  it("is a named group; the detail follows the status", async () => {
    const host = mount(
      `<ui-attachment name="plan.pdf" size="240 KB" variant="preview"></ui-attachment>`,
    );
    const el = host.querySelector<UiAttachment>("ui-attachment")!;
    expect(await ax("group", "Adjunto plan.pdf")).toBeTruthy();
    expect(shadow(el).querySelector<HTMLElement>("[part=detail]")!.textContent).toBe("240 KB");
    el.setAttribute("status", "error");
    expect(shadow(el).querySelector<HTMLElement>("[part=detail]")!.textContent).toBe(
      "Error al subir",
    );
  });

  it("shows an accessible progressbar only while uploading", async () => {
    const host = mount(
      `<ui-attachment name="a.png" status="uploading" progress="42.4"></ui-attachment>`,
    );
    const el = host.querySelector<UiAttachment>("ui-attachment")!;
    const bar = await ax("progressbar", "Progreso de a.png");
    expect(bar?.value).toBe(42);
    el.setAttribute("status", "done");
    expect(shadow(el).querySelector<HTMLElement>("[part=progress]")!.hidden).toBe(true);
  });

  it("removes through a labelled button that fires remove", async () => {
    const host = mount(`<ui-attachment name="a.png" removable></ui-attachment>`);
    const el = host.querySelector<UiAttachment>("ui-attachment")!;
    const onRemove = vi.fn();
    el.addEventListener("remove", onRemove);
    expect(await ax("button", "Quitar a.png")).toBeTruthy();
    shadow(el).querySelector<HTMLButtonElement>("[part=remove]")!.click();
    expect(onRemove).toHaveBeenCalledOnce();
    expect(el.isConnected).toBe(true);
  });

  it("renders a hostile file name as text", () => {
    (window as unknown as { hacked?: boolean }).hacked = false;
    const evil = `<img src=x onerror="window.hacked=true">`;
    const host = mount(`<ui-attachment name="x"></ui-attachment>`);
    const el = host.querySelector<UiAttachment>("ui-attachment")!;
    el.name = evil;
    expect(shadow(el).querySelector("[part=name]")!.textContent).toBe(evil);
    expect(shadow(el).querySelectorAll("[part=name] *").length).toBe(0);
    expect((window as unknown as { hacked?: boolean }).hacked).toBe(false);
  });

  it("registers under a custom prefix", () => {
    expect(defineAttachment({ prefix: "acme" })).toBe("acme-attachment");
  });
});
