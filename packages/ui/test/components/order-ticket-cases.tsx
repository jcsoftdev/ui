import { renderToStaticMarkup } from "react-dom/server";
import { OrderTicket } from "../../src/containers/order-ticket/order-ticket.js";
import { UiStringsProvider } from "../../src/i18n/index.js";
import { Truck } from "../../src/icons/index.js";
export {
  orderTicketState,
  splitTicketLines,
  ticketLineCost,
  warnLeadSeconds,
} from "../../src/containers/order-ticket/model.js";

const since = (seconds) => new Date(Date.now() - seconds * 1000);
const toggle = () => undefined;

const lines = [
  { id: "a", qty: 2, name: "Lomo saltado", status: "done", onToggle: toggle },
  { id: "b", qty: 1, name: "Ceviche", modifiers: ["Sin cebolla"], status: "in-progress", onToggle: toggle },
  { id: "c", qty: 1, name: "Ají de gallina", note: "Poco picante", allergy: "Maní", onToggle: toggle },
];

const base = { table: "Mesa 8", guests: 4, server: "Rosa", since: since(60), targetMinutes: 20, lines };

export const html = {
  ticket: (props = {}) => renderToStaticMarkup(<OrderTicket {...base} {...props} />),
  ticketEs: (props = {}) =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <OrderTicket {...base} {...props} />
      </UiStringsProvider>,
    ),
  late: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <OrderTicket {...base} since={since(20 * 60 + 75)} />
      </UiStringsProvider>,
    ),
  takeaway: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <OrderTicket
          number={42}
          channel={{ label: "Delivery", icon: <Truck size={20} /> }}
          customer="Ana"
          since={since(60)}
          targetMinutes={20}
          lines={lines}
        />
      </UiStringsProvider>,
    ),
};
