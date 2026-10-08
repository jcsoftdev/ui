import type { Meta, StoryObj } from "@storybook/react-vite";
import { Paperclip } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Attachment } from "./attachment/attachment.js";
import { ChainOfThought } from "./chain-of-thought/chain-of-thought.js";
import { ChatList, type ChatListItem } from "./chat-list/chat-list.js";
import { ChatMessage } from "./chat-message/chat-message.js";
import { Conversation } from "./conversation/conversation.js";
import { Markdown } from "./markdown/markdown.js";
import { MessageActions } from "./message-actions/message-actions.js";
import { PromptInput } from "./prompt-input/prompt-input.js";
import { PromptSuggestion, PromptSuggestionList } from "./prompt-suggestion/prompt-suggestion.js";
import { Source } from "./source/source.js";
import { ToolCall } from "./tool-call/tool-call.js";

type Stage = "thinking" | "searching" | "answering" | "done";

interface Turn {
  id: number;
  user: string;
  stage: Stage;
  text: string;
}

const REPLY = `Mañana tienes **3 huecos libres** con Diego Quispe:

| Hora | Servicio sugerido | Precio |
| :-- | :-- | --: |
| 10:00 | Corte clásico | S/ 35 |
| 11:30 | Corte + barba | S/ 55 |
| 16:00 | Perfilado | S/ 20 |

Si quieres, reservo uno de inmediato. También puedes consultarlo con este comando:

\`\`\`bash
curl -s "https://api.example.com/turnos?fecha=2026-06-21&barbero=diego"
\`\`\`

> Los turnos se confirman por WhatsApp con 24 horas de anticipación.`;

const HISTORY: ChatListItem[] = [
  {
    id: "a",
    title: "Turnos libres de mañana",
    updatedAt: new Date(2026, 5, 20, 10),
    preview: "Tienes tres huecos…",
  },
  {
    id: "b",
    title: "Resumen de ingresos",
    updatedAt: new Date(2026, 5, 20, 8),
    preview: "La semana cerró en S/ 4 820.",
  },
  {
    id: "c",
    title: "Recordatorio a clientes",
    updatedAt: new Date(2026, 5, 19, 17),
    preview: "Envié 12 mensajes.",
  },
  {
    id: "d",
    title: "Inventario de cera",
    updatedAt: new Date(2026, 5, 15, 12),
    preview: "Quedan 3 unidades.",
  },
  {
    id: "e",
    title: "Promoción de Fiestas Patrias",
    updatedAt: new Date(2026, 4, 28, 12),
    preview: "Combo corte + barba.",
  },
];

const STEPS = [
  { id: "1", label: "Entender el pedido", detail: "Turnos libres para mañana." },
  { id: "2", label: "Consultar la agenda de Diego" },
  { id: "3", label: "Redactar la respuesta" },
];

function Assistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [files, setFiles] = useState(["agenda-sabado.pdf"]);
  const timers = useRef<number[]>([]);
  const ticker = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    window.clearInterval(ticker.current);
    setStreaming(false);
    setTurns((list) => list.map((t) => (t.stage === "done" ? t : { ...t, stage: "done" })));
  }, []);

  useEffect(() => stop, [stop]);

  const patch = (id: number, change: Partial<Turn>) =>
    setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));

  const send = (user: string) => {
    const id = Date.now();
    setTurns((list) => [...list, { id, user, stage: "thinking", text: "" }]);
    setStreaming(true);
    setFiles([]);
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    later(900, () => patch(id, { stage: "searching" }));
    later(2200, () => {
      patch(id, { stage: "answering" });
      let n = 0;
      ticker.current = window.setInterval(() => {
        n += 4;
        if (n >= REPLY.length) {
          window.clearInterval(ticker.current);
          patch(id, { stage: "done", text: REPLY });
          setStreaming(false);
        } else patch(id, { text: REPLY.slice(0, n) });
      }, 30);
    });
  };

  return (
    <div className="@container/demo h-[640px] max-w-5xl overflow-hidden rounded-card bg-bg text-ink border-card shadow-card">
      <div className="grid h-full @3xl/demo:grid-cols-[16rem_1fr]">
        <aside className="hidden overflow-y-auto border-r border-line p-card @3xl/demo:block">
          <ChatList
            items={HISTORY}
            activeId="a"
            now={new Date(2026, 5, 20, 12)}
            onNew={() => setTurns([])}
            onSelect={() => {}}
          />
        </aside>
        <section
          aria-label="Asistente de la barbería"
          className="grid min-h-0 min-w-0 grid-rows-[1fr_auto]"
        >
          <Conversation label="Conversación con el asistente">
            <ChatMessage author="system" content="Hoy, 20 de junio · Sede Miraflores" />
            <ChatMessage
              author="assistant"
              name="Asistente"
              content="Hola, soy el asistente de la barbería. Puedo revisar la agenda, los ingresos y el inventario."
            />
            {turns.length === 0 ? (
              <PromptSuggestionList>
                <PromptSuggestion onSelect={send}>¿Qué turnos libres hay mañana?</PromptSuggestion>
                <PromptSuggestion onSelect={send}>
                  Resume los ingresos de la semana
                </PromptSuggestion>
              </PromptSuggestionList>
            ) : null}
            {turns.map((turn) => {
              const stepStatus = (index: number) => {
                const at = { thinking: 0, searching: 1, answering: 2, done: 3 }[turn.stage];
                return index < at ? "done" : index === at ? "active" : "pending";
              };
              return (
                <div key={turn.id} className="grid gap-density-lg">
                  <ChatMessage author="user" name="Luis Paredes" content={turn.user} />
                  <ChatMessage
                    author="assistant"
                    name="Asistente"
                    status={turn.stage === "done" ? "done" : "streaming"}
                    footer={
                      turn.stage === "done" ? (
                        <div className="grid gap-density-sm">
                          <div className="flex flex-wrap gap-density-sm">
                            <Source
                              index={1}
                              title="Agenda de Diego Quispe"
                              url="https://agenda.example.com/diego"
                              snippet="Turnos del día con horarios libres y ocupados."
                            />
                            <Source
                              index={2}
                              title="Política de confirmación"
                              url="https://ayuda.example.com/confirmacion"
                              snippet="Los turnos se confirman por WhatsApp con 24 horas de anticipación."
                            />
                          </div>
                          <MessageActions
                            text={turn.text}
                            onRegenerate={() => send(turn.user)}
                            onFeedback={() => {}}
                          />
                        </div>
                      ) : null
                    }
                  >
                    <div className="grid gap-density-sm">
                      <ChainOfThought
                        defaultOpen
                        duration={turn.stage === "done" ? "3 s" : undefined}
                        steps={STEPS.map((step, i) => ({
                          ...step,
                          status: stepStatus(i) as "done" | "active" | "pending",
                        }))}
                      />
                      {turn.stage !== "thinking" ? (
                        <ToolCall
                          name="buscar_turnos"
                          status={turn.stage === "searching" ? "running" : "done"}
                          args={{ fecha: "2026-06-21", barbero: "Diego Quispe" }}
                          result={
                            turn.stage === "searching"
                              ? undefined
                              : { libres: ["10:00", "11:30", "16:00"] }
                          }
                        />
                      ) : null}
                      {turn.text ? (
                        <Markdown streaming={turn.stage === "answering"}>{turn.text}</Markdown>
                      ) : null}
                    </div>
                  </ChatMessage>
                </div>
              );
            })}
          </Conversation>
          <div className="p-card pt-0">
            <PromptInput
              streaming={streaming}
              onStop={stop}
              onSubmit={send}
              placeholder="Pregunta por turnos, clientes o ingresos…"
              hint="Enter envía · Shift+Enter agrega una línea"
              attachments={files.map((name) => (
                <Attachment
                  key={name}
                  name={name}
                  size="240 KB"
                  onRemove={() => setFiles((list) => list.filter((f) => f !== name))}
                />
              ))}
              actions={
                <button
                  type="button"
                  aria-label="Adjuntar archivo"
                  className="inline-grid size-8 cursor-pointer place-items-center rounded-button text-ink-3 pressable hover:bg-surface-2 hover:text-ink focus-visible:focus-ring"
                >
                  <Paperclip aria-hidden className="size-4" />
                </button>
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}

const meta = {
  title: "AI/Asistente",
  component: Assistant,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Assistant>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full chat with simulated streaming: press a suggestion or type a message. */
export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal">
        <Story />
      </div>
    ),
  ],
};
