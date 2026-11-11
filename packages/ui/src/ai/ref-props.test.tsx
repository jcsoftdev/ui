import type { RefObject } from "react";
import type { AttachmentProps } from "./attachment/attachment.js";
import type { ChatMessageProps } from "./chat-message/chat-message.js";
import type { ConversationProps } from "./conversation/conversation.js";
import type { IconActionProps } from "./internal/icon-action.js";
import type { MessageActionsProps } from "./message-actions/message-actions.js";
import type {
  PromptSuggestionListProps,
  PromptSuggestionProps,
} from "./prompt-suggestion/prompt-suggestion.js";
import type { SourceProps } from "./source/source.js";

type RefAccepted<P, E extends Element> =
  RefObject<E | null> extends NonNullable<P extends { ref?: infer R } ? R : never> ? true : false;

type Assert<T extends true> = T;

export type RefPropsChecked = [
  Assert<RefAccepted<AttachmentProps, HTMLFieldSetElement>>,
  Assert<RefAccepted<ChatMessageProps, HTMLElement>>,
  Assert<RefAccepted<ConversationProps, HTMLDivElement>>,
  Assert<RefAccepted<IconActionProps, HTMLButtonElement>>,
  Assert<RefAccepted<MessageActionsProps, HTMLDivElement>>,
  Assert<RefAccepted<PromptSuggestionProps, HTMLButtonElement>>,
  Assert<RefAccepted<PromptSuggestionListProps, HTMLFieldSetElement>>,
  Assert<RefAccepted<SourceProps, HTMLAnchorElement>>,
];

export const intentProps = {
  attachment: { intent: "probe", intentKey: "k1" } satisfies Pick<
    AttachmentProps,
    "intent" | "intentKey"
  >,
  chatMessage: { intent: "probe", intentKey: "k1" } satisfies Pick<
    ChatMessageProps,
    "intent" | "intentKey"
  >,
  iconAction: { intent: "probe", intentKey: "k1" } satisfies Pick<
    IconActionProps,
    "intent" | "intentKey"
  >,
  promptSuggestion: { intent: "probe", intentKey: "k1" } satisfies Pick<
    PromptSuggestionProps,
    "intent" | "intentKey"
  >,
  source: { intent: "probe", intentKey: "k1" } satisfies Pick<SourceProps, "intent" | "intentKey">,
};
