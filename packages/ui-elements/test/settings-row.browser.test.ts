import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineSettingsRow, type UiSettingsRow } from "../src/settings-row/settings-row.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineSettingsRow();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-settings-row", () => {
  it("renders heading and description, and a control can be named by the title", () => {
    const host = mount(`<ui-settings-row heading="Notifications" description="Email me">
      <button id="c">Edit</button></ui-settings-row>`);
    const row = host.querySelector<UiSettingsRow>("ui-settings-row")!;
    const body = row.firstElementChild!;
    expect(body.getAttribute("data-ui-part")).toBe("body");
    expect(body.textContent).toBe("NotificationsEmail me");
    expect(row.querySelector(`#${row.titleId}`)?.textContent).toBe("Notifications");
    row.setAttribute("heading", "Alerts");
    row.removeAttribute("description");
    expect(row.querySelector(`#${row.titleId}`)?.textContent).toBe("Alerts");
    expect(body.textContent).toBe("Alerts");
    expect(row.lastElementChild?.id).toBe("c");
  });

  it("wraps the control under the text when narrow and drops the first divider", () => {
    const html = (width: number) => `<ui-settings-row heading="Name" style="width:${width}px">
      <button style="width:120px">Edit</button></ui-settings-row>`;
    const wide = mount(html(500)).querySelector("ui-settings-row")!;
    const button = (row: Element) => row.querySelector("button")!.getBoundingClientRect();
    const body = (row: Element) => row.firstElementChild!.getBoundingClientRect();
    expect(button(wide).top).toBeLessThan(body(wide).bottom);
    const narrow = mount(html(200)).querySelector("ui-settings-row")!;
    expect(button(narrow).top).toBeGreaterThanOrEqual(body(narrow).bottom);
    expect(getComputedStyle(wide).borderTopWidth).toBe("0px");
  });
});
