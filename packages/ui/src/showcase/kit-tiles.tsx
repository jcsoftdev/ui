import { Banknote, CreditCard, Scissors, Smartphone, Smile, Sparkles } from "lucide-react";
import { useState } from "react";
import { ChatMessage } from "../ai/chat-message/index.js";
import { Conversation } from "../ai/conversation/index.js";
import { Markdown } from "../ai/markdown/index.js";
import { PromptInput } from "../ai/prompt-input/index.js";
import { PromptSuggestion, PromptSuggestionList } from "../ai/prompt-suggestion/index.js";
import { ToolCall } from "../ai/tool-call/index.js";
import { CheckboxButtonGroup } from "../forms/checkbox-button-group/index.js";
import { EmojiReactionBar, type Reaction } from "../forms/emoji-reaction-button/index.js";
import { InlineSelect } from "../forms/inline-select/index.js";
import { NumberStepper } from "../forms/number-stepper/index.js";
import { RadioButtonGroup } from "../forms/radio-button-group/index.js";
import { Rating } from "../forms/rating/index.js";
import { Slider } from "../forms/slider/index.js";
import { RichTextEditor } from "../rich-text/index.js";
import { Tile, useOverlayContainer } from "./bento.js";

const servicios = [
  { value: "corte", label: "Corte", description: "S/ 35 · 30 min", icon: <Scissors /> },
  { value: "barba", label: "Barba", description: "S/ 25 · 20 min", icon: <Smile /> },
  { value: "facial", label: "Limpieza facial", description: "S/ 40 · 25 min", icon: <Sparkles /> },
];

const pagos = [
  { value: "yape", label: "Yape", description: "Pago inmediato", icon: <Smartphone /> },
  { value: "tarjeta", label: "Tarjeta", description: "Visa / Mastercard", icon: <CreditCard /> },
  { value: "efectivo", label: "Efectivo", description: "En el local", icon: <Banknote /> },
];

const frecuencias = [
  { value: "dia", label: "día" },
  { value: "semana", label: "semana" },
  { value: "mes", label: "mes" },
];

/** Reserve flow: pick services and a payment method. */
export function BookingTile({ index }: { index: number }) {
  return (
    <Tile title="Reserva" subtitle="Servicios y medio de pago" cols={3} rows={3} index={index}>
      <div className="flex h-full min-w-0 flex-col justify-center gap-density">
        <CheckboxButtonGroup options={servicios} defaultValue={["corte"]} aria-label="Servicios" />
        <RadioButtonGroup options={pagos} defaultValue="yape" aria-label="Método de pago" />
      </div>
    </Tile>
  );
}

/** Slider, rating, stepper, inline select and emoji reactions. */
export function TuningTile({ index }: { index: number }) {
  const container = useOverlayContainer();
  const [reactions, setReactions] = useState<Reaction[]>([
    { emoji: "🔥", count: 7, reacted: true },
    { emoji: "💈", count: 4 },
  ]);
  const react = (emoji: string, reacted: boolean) =>
    setReactions((list) => {
      const found = list.find((item) => item.emoji === emoji);
      if (!found) return [...list, { emoji, count: 1, reacted: true }];
      return list.map((item) =>
        item.emoji === emoji
          ? { ...item, reacted, count: Math.max(0, item.count + (reacted ? 1 : -1)) }
          : item,
      );
    });
  return (
    <Tile
      title="Ajustes del servicio"
      subtitle="Controles numéricos"
      cols={3}
      rows={3}
      index={index}
    >
      <div className="flex h-full min-w-0 flex-col justify-center gap-density">
        <Slider
          min={0}
          max={50}
          step={5}
          defaultValue={15}
          showValue
          formatValue={(value: number) => `${value}%`}
          aria-label="Descuento por fidelidad"
        />
        <div className="flex flex-wrap items-center justify-between gap-density-sm">
          <Rating defaultValue={4} aria-label="Valoración del corte" showValue />
          <NumberStepper
            className="w-40 shrink-0"
            defaultValue={2}
            min={0}
            max={10}
            unit="unid."
            aria-label="Productos"
          />
        </div>
        <p className="m-0 flex flex-wrap items-center gap-x-1 text-body text-ink">
          Repetir la cita cada{" "}
          <InlineSelect options={frecuencias} defaultValue="semana" aria-label="Frecuencia" />
          con el mismo barbero.
        </p>
        <EmojiReactionBar reactions={reactions} onReact={react} container={container} />
      </div>
    </Tile>
  );
}

export function NoteTile({ index }: { index: number }) {
  return (
    <Tile
      title="Nota del cliente"
      subtitle="Editor de texto enriquecido"
      cols={2}
      rows={4}
      index={index}
    >
      <RichTextEditor
        defaultValue="<p><strong>Degradado alto</strong> con la parte superior a tijera. Prefiere <em>sin cera</em>.</p>"
        aria-label="Nota de estilo del cliente"
        minHeightRem={9}
      />
    </Tile>
  );
}

const RESPUESTA = `Mañana Diego tiene **3 huecos libres**:

| Hora | Servicio | Precio |
| :-- | :-- | --: |
| 10:00 | Corte clásico | S/ 35 |
| 11:30 | Corte + barba | S/ 55 |
| 16:00 | Perfilado | S/ 25 |`;

interface Turn {
  id: number;
  user: string;
}

/** Mini assistant: a conversation, a tool call, a Markdown table and the prompt input. */
export function AssistantTile({ index }: { index: number }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const send = (user: string) => setTurns((list) => [...list, { id: list.length + 1, user }]);
  return (
    <Tile
      title="Asistente IA"
      subtitle="Pregunta por turnos, clientes o ingresos"
      cols={4}
      rows={4}
      index={index}
      flush
    >
      <section
        aria-label="Asistente de la barbería"
        className="grid h-full min-h-0 grid-rows-[1fr_auto]"
      >
        <Conversation label="Conversación con el asistente">
          <ChatMessage
            author="assistant"
            name="Asistente"
            content="Hola, soy el asistente de la barbería. Puedo revisar la agenda y los ingresos."
          />
          {turns.length === 0 ? (
            <PromptSuggestionList>
              <PromptSuggestion onSelect={send}>¿Qué turnos libres hay mañana?</PromptSuggestion>
              <PromptSuggestion onSelect={send}>Resume los ingresos de la semana</PromptSuggestion>
            </PromptSuggestionList>
          ) : null}
          {turns.map((turn) => (
            <div key={turn.id} className="grid gap-density-lg">
              <ChatMessage author="user" name="Luis" content={turn.user} />
              <ChatMessage author="assistant" name="Asistente" status="done">
                <div className="grid gap-density-sm">
                  <ToolCall
                    name="buscar_turnos"
                    status="done"
                    args={{ fecha: "2026-10-09", barbero: "Diego Quispe" }}
                    result={{ libres: ["10:00", "11:30", "16:00"] }}
                  />
                  <Markdown>{RESPUESTA}</Markdown>
                </div>
              </ChatMessage>
            </div>
          ))}
        </Conversation>
        <div className="p-card pt-0">
          <PromptInput
            onSubmit={send}
            placeholder="Pregunta por turnos, clientes o ingresos…"
            hint="Enter envía · Shift+Enter agrega una línea"
          />
        </div>
      </section>
    </Tile>
  );
}
