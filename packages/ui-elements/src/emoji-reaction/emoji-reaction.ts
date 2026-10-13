import { type DefineOptions, defineElement } from "../internal/base.js";
import { UiEmojiReaction } from "../internal/emoji-reaction.js";

export { UiEmojiReaction };

/** Registers `<ui-emoji-reaction>` (or `<prefix-emoji-reaction>`) and returns the tag. */
export function defineEmojiReaction(options?: DefineOptions): string {
  return defineElement("emoji-reaction", UiEmojiReaction, options);
}
