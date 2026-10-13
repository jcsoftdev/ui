import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineComment } from "../src/comment/comment.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineComment();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-comment", () => {
  it("is a named note with the author, counter and body", async () => {
    const host = mount(
      `<ui-comment author="Ana" number="2" label="Comment from Ana">Please recheck.</ui-comment>`,
    );
    const comment = host.querySelector("ui-comment")!;
    expect(await ax("note", "Comment from Ana")).toBeTruthy();
    expect(comment.textContent).toBe("2 · Ana — Please recheck.");
    comment.setAttribute("author", "Bo");
    comment.removeAttribute("number");
    expect(comment.textContent).toBe("Bo — Please recheck.");
  });

  it("tone reply swaps the surface", () => {
    const host = mount(`<ui-comment author="Ana" label="x">Hi</ui-comment>`);
    const comment = host.querySelector("ui-comment")!;
    const pending = getComputedStyle(comment).backgroundColor;
    comment.setAttribute("tone", "reply");
    expect(getComputedStyle(comment).backgroundColor).not.toBe(pending);
  });
});
