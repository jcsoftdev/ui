import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, within } from "storybook/test";
import { Attachment } from "../ai/attachment/attachment.js";
import { ChatMessage } from "../ai/chat-message/chat-message.js";
import { MessageActions } from "../ai/message-actions/message-actions.js";
import { PromptInput } from "../ai/prompt-input/prompt-input.js";
import { PromptSuggestion } from "../ai/prompt-suggestion/prompt-suggestion.js";
import { Source } from "../ai/source/source.js";
import { ToolCall } from "../ai/tool-call/tool-call.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";

interface Registration {
  intent: string;
  key: string | undefined;
  role: string;
  requireName: boolean;
}

const noop = () => {};

function AiDemo({ live }: { live: Registration[] }) {
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget(ref, _element, expectation) {
        const entry: Registration = {
          intent: ref.intent,
          key: ref.key,
          role: expectation.role,
          requireName: expectation.requireName,
        };
        live.push(entry);
        return () => {
          live.splice(live.indexOf(entry), 1);
        };
      },
    }),
    [live],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      <PromptInput intent="prompt-input" intentKey="k" />
      <PromptSuggestion intent="prompt-suggestion" intentKey="k">
        Suggest something
      </PromptSuggestion>
      <Attachment name="menu.pdf" onRemove={noop} intent="attachment-remove" intentKey="k" />
      <Source
        title="Docs"
        url="https://example.com/docs"
        intent="source"
        intentKey="k"
        snippet="An excerpt"
      />
      <ChatMessage
        author="assistant"
        name="Assistant"
        content="Hello"
        intent="chat-message"
        intentKey="k"
      />
      <ToolCall name="search_tables" intent="tool-call" intentKey="k" />
      <MessageActions
        text="Hello"
        onRegenerate={noop}
        onFeedback={noop}
        actionIntents={{
          copy: { intent: "copy", intentKey: "m1" },
          regenerate: { intent: "regenerate", intentKey: "m1" },
          like: { intent: "like", intentKey: "m1" },
          dislike: { intent: "dislike", intentKey: "m1" },
        }}
      />
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/AI",
  component: AiDemo,
  parameters: { layout: "padded" },
  args: { live: [] },
} satisfies Meta<typeof AiDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectedRegistrations: Array<[string, string, string]> = [
  ["prompt-input", "textbox", "Mensaje"],
  ["copy", "button", "Copiar mensaje"],
  ["regenerate", "button", "Regenerar respuesta"],
  ["like", "button", "Me gusta"],
  ["dislike", "button", "No me gusta"],
];

const serverRendered = [
  "prompt-suggestion",
  "attachment-remove",
  "source",
  "chat-message",
  "tool-call",
];

export const RegistersClientTargets: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const { live } = args;
    for (const [intent, role, name] of expectedRegistrations) {
      const matches = live.filter((item) => item.intent === intent);
      await expect(matches).toHaveLength(1);
      await expect(matches[0]?.role).toBe(role);
      await expect(matches[0]?.requireName).toBe(true);
      await expect(canvas.getByRole(role, { name })).toHaveAttribute("data-intent", intent);
    }
    await expect(live).toHaveLength(expectedRegistrations.length);
    for (const intent of serverRendered) {
      await expect(canvasElement.querySelector(`[data-intent="${intent}"]`)).not.toBeNull();
      await expect(live.some((item) => item.intent === intent)).toBe(false);
    }
  },
};

export const ServerRenderedTargets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Suggest something" })).toHaveAttribute(
      "data-intent",
      "prompt-suggestion",
    );
    await expect(canvas.getByRole("button", { name: "Quitar menu.pdf" })).toHaveAttribute(
      "data-intent",
      "attachment-remove",
    );
    await expect(canvas.getByRole("link", { name: /example\.com/ })).toHaveAttribute(
      "data-intent",
      "source",
    );
    await expect(canvas.getByRole("article", { name: "Assistant" })).toHaveAttribute(
      "data-intent-key",
      "k",
    );
  },
};
