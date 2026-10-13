import { renderToStaticMarkup } from "react-dom/server";
import { Form, FormError, FormStatus } from "../../src/forms/form/form.js";
import { Grid } from "../../src/containers/grid/grid.js";

export const html = {
  gridFluid: () => renderToStaticMarkup(<Grid minColumnWidth="12rem" />),
  gridFixed: () => renderToStaticMarkup(<Grid columns={3} />),
  formError: (message) => renderToStaticMarkup(<FormError message={message} />),
  formStatus: (message) => renderToStaticMarkup(<FormStatus message={message} />),
  form: () => renderToStaticMarkup(<Form action="/save" className="extra" />),
};
