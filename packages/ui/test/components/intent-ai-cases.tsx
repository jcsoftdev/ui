import { renderToStaticMarkup } from "react-dom/server";
import { Attachment } from "../../src/ai/attachment/attachment.js";
import { ChatMessage } from "../../src/ai/chat-message/chat-message.js";
import { IconAction } from "../../src/ai/internal/icon-action.js";
import { MessageActions } from "../../src/ai/message-actions/message-actions.js";
import { PromptInput } from "../../src/ai/prompt-input/prompt-input.js";
import { PromptSuggestion } from "../../src/ai/prompt-suggestion/prompt-suggestion.js";
import { Source } from "../../src/ai/source/source.js";
import { ToolCall } from "../../src/ai/tool-call/tool-call.js";

const probe = { intent: "probe", intentKey: "k1" };
const noop = () => {};

export const cases = {
  promptInput: { tag: "textarea", markup: () => renderToStaticMarkup(<PromptInput {...probe} />) },
  promptSuggestion: {
    tag: "button",
    markup: () => renderToStaticMarkup(<PromptSuggestion {...probe}>Try this</PromptSuggestion>),
  },
  iconAction: {
    tag: "button",
    markup: () => renderToStaticMarkup(<IconAction label="Copy" {...probe} />),
  },
  attachment: {
    tag: "button",
    markup: () => renderToStaticMarkup(<Attachment name="a.pdf" onRemove={noop} {...probe} />),
  },
  source: {
    tag: "a",
    markup: () =>
      renderToStaticMarkup(<Source title="Docs" url="https://example.com/a" {...probe} />),
  },
  chatMessage: {
    tag: "article",
    markup: () => renderToStaticMarkup(<ChatMessage author="user" content="hi" {...probe} />),
  },
  chatMessageSystem: {
    tag: "article",
    markup: () => renderToStaticMarkup(<ChatMessage author="system" content="hi" {...probe} />),
  },
  toolCall: { tag: "div", markup: () => renderToStaticMarkup(<ToolCall name="search" {...probe} />) },
};

export const messageActionMarkup = () =>
  renderToStaticMarkup(
    <MessageActions
      text="hello"
      onRegenerate={noop}
      onFeedback={noop}
      actionIntents={{
        copy: { intent: "copy", intentKey: "m1" },
        regenerate: { intent: "regenerate", intentKey: "m1" },
        like: { intent: "like", intentKey: "m1" },
        dislike: { intent: "dislike", intentKey: "m1" },
      }}
    />,
  );
