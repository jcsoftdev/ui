import { renderToStaticMarkup } from "react-dom/server";
import { Grid } from "../../src/containers/grid/grid.js";

export const html = {
  gridFluid: () => renderToStaticMarkup(<Grid minColumnWidth="12rem" />),
  gridFixed: () => renderToStaticMarkup(<Grid columns={3} />),
};
