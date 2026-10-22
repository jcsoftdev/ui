import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { definePromptSuggestion } from "../src/prompt-suggestion/prompt-suggestion.ts";
import { definePromptSuggestionList } from "../src/prompt-suggestion-list/prompt-suggestion-list.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  definePromptSuggestion();
  definePromptSuggestionList();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-prompt-suggestion", () => {
  it("is a native button named by its text and selects with Enter or click", async () => {
    const host = mount(
      `<ui-prompt-suggestion-list><ui-prompt-suggestion>Resume este texto</ui-prompt-suggestion><ui-prompt-suggestion disabled>No</ui-prompt-suggestion></ui-prompt-suggestion-list>`,
    );
    expect(await ax("group", "Sugerencias")).toBeTruthy();
    expect(await ax("button", "Resume este texto")).toBeTruthy();
    const first = host.querySelector("ui-prompt-suggestion") as HTMLElement;
    const onSelect = vi.fn();
    host.addEventListener("select", (e) => onSelect((e as CustomEvent).detail));
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith({ text: "Resume este texto" });
    (host.querySelectorAll("ui-prompt-suggestion")[1] as HTMLElement)
      .shadowRoot!.querySelector("button")!
      .click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("honours a custom list label", async () => {
    mount(`<ui-prompt-suggestion-list label="Ideas"></ui-prompt-suggestion-list>`);
    expect(await ax("group", "Ideas")).toBeTruthy();
  });
});
