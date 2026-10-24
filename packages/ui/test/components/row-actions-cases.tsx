import { renderToStaticMarkup } from "react-dom/server";
import { RowActions, type RowActionItem } from "../../src/containers/row-actions/row-actions.js";

const items: RowActionItem[] = [
  { id: "delete", label: "Delete", tone: "danger", onSelect: () => {} },
  { id: "edit", label: "Edit", onSelect: () => {} },
];

export const html = {
  full: () =>
    renderToStaticMarkup(
      <RowActions label="Actions for Ana" primary={<button type="button">Open</button>} items={items} />,
    ),
  primaryOnly: () =>
    renderToStaticMarkup(
      <RowActions label="Actions for Ana" primary={<button type="button">Open</button>} items={[]} />,
    ),
};
