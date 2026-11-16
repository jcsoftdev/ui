import { renderToStaticMarkup } from "react-dom/server";
import { Kpi } from "../../src/containers/kpi/kpi.js";

export const html = {
  composed: () =>
    renderToStaticMarkup(
      <Kpi>
        <Kpi.Label>Revenue</Kpi.Label>
        <Kpi.Value>S/ 10</Kpi.Value>
        <Kpi.Description>per day</Kpi.Description>
      </Kpi>,
    ),
};
