import { button, type CalendarEvent, node, srLabel } from "./e12-cal.js";

/**
 * The button of an event (React `EventBlock`). `trailing` overrides `event.trailing`; the
 * standalone element passes a slot.
 */
export function eventButton(
  event: CalendarEvent,
  variant: "detailed" | "compact" = "detailed",
  trailing: string | Node | undefined = event.trailing,
): HTMLButtonElement {
  const block = button("event", "event", event.id);
  block.dataset.tone = event.tone ?? "accent";
  block.dataset.variant = variant;
  block.append(srLabel(event.srLabel) ?? "");
  if (variant === "compact") {
    block.append(`${event.start} ${event.title}`);
    return block;
  }
  const layout = node("span", "layout");
  const body = node("span", "body");
  body.append(node("span", "title", event.title));
  if (event.subtitle) body.append(node("span", "subtitle", event.subtitle));
  layout.append(
    node("span", "time", event.end ? `${event.start}–${event.end}` : event.start),
    body,
  );
  if (trailing) {
    const end = node("span", "trailing");
    end.append(
      typeof trailing === "string" || trailing instanceof HTMLSlotElement
        ? trailing
        : trailing.cloneNode(true),
    );
    layout.append(end);
  }
  block.append(layout);
  return block;
}
