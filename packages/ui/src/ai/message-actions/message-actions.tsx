"use client";

import { type ComponentPropsWithRef, useState } from "react";
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from "../../icons/index.js";
import type { IntentProps } from "../../intent/types.js";
import { useIntentTarget } from "../../intent/use-intent-target.js";
import { cn } from "../../utils/cn.js";
import { IconAction } from "../internal/icon-action.js";
import { useCopy } from "../internal/use-copy.js";

export type MessageFeedback = "like" | "dislike" | null;

export type MessageActionName = "copy" | "regenerate" | "like" | "dislike";

export interface MessageActionsProps extends Omit<ComponentPropsWithRef<"div">, "onCopy"> {
  actionIntents?: Partial<Record<MessageActionName, IntentProps>>;
  /** Text copied by the copy button. */
  text: string;
  onCopy?: (text: string) => void;
  /** Omit to hide the regenerate button. */
  onRegenerate?: () => void;
  /** Omit to hide the like/dislike buttons. */
  onFeedback?: (value: MessageFeedback) => void;
  feedback?: MessageFeedback;
  defaultFeedback?: MessageFeedback;
}

/** Copy, regenerate, like and dislike for an assistant message. Feedback toggles off on re-press. */
export function MessageActions({
  text,
  onCopy,
  onRegenerate,
  onFeedback,
  feedback: feedbackProp,
  defaultFeedback = null,
  actionIntents,
  className,
  ...props
}: MessageActionsProps) {
  const copyIntent = actionIntents?.copy;
  const regenerateIntent = actionIntents?.regenerate;
  const likeIntent = actionIntents?.like;
  const dislikeIntent = actionIntents?.dislike;
  const copyRef = useIntentTarget<HTMLButtonElement>({ ...copyIntent });
  const regenerateRef = useIntentTarget<HTMLButtonElement>({ ...regenerateIntent });
  const likeRef = useIntentTarget<HTMLButtonElement>({ ...likeIntent });
  const dislikeRef = useIntentTarget<HTMLButtonElement>({ ...dislikeIntent });
  const { copied, copy } = useCopy();
  const [state, setState] = useState<MessageFeedback>(defaultFeedback);
  const feedback = feedbackProp === undefined ? state : feedbackProp;

  const choose = (value: Exclude<MessageFeedback, null>) => {
    const next = feedback === value ? null : value;
    if (feedbackProp === undefined) setState(next);
    onFeedback?.(next);
  };

  return (
    <div
      role="toolbar"
      aria-label="Acciones del mensaje"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    >
      <IconAction
        {...copyIntent}
        ref={copyRef}
        label={copied ? "Mensaje copiado" : "Copiar mensaje"}
        onClick={() => {
          copy(text);
          onCopy?.(text);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </IconAction>
      {onRegenerate ? (
        <IconAction
          {...regenerateIntent}
          ref={regenerateRef}
          label="Regenerar respuesta"
          onClick={onRegenerate}
        >
          <RefreshCw aria-hidden />
        </IconAction>
      ) : null}
      {onFeedback ? (
        <>
          <IconAction
            {...likeIntent}
            ref={likeRef}
            label="Me gusta"
            aria-pressed={feedback === "like"}
            onClick={() => choose("like")}
          >
            <ThumbsUp aria-hidden />
          </IconAction>
          <IconAction
            {...dislikeIntent}
            ref={dislikeRef}
            label="No me gusta"
            aria-pressed={feedback === "dislike"}
            onClick={() => choose("dislike")}
          >
            <ThumbsDown aria-hidden />
          </IconAction>
        </>
      ) : null}
    </div>
  );
}
