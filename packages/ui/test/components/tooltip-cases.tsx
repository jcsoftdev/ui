import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../../src/atoms/button/button.js";
import { Tooltip } from "../../src/overlays/tooltip/tooltip.js";
export { joinIds } from "../../src/overlays/tooltip/model.js";

export const html = {
  persistent: () =>
    renderToStaticMarkup(
      <Tooltip content="Duplicates the order" describeTrigger="always">
        <Button>Copy</Button>
      </Tooltip>,
    ),
  persistentWithOwn: () =>
    renderToStaticMarkup(
      <Tooltip content="Duplicates the order" describeTrigger="always">
        <Button aria-describedby="err">Copy</Button>
      </Tooltip>,
    ),
  openWithOwn: () =>
    renderToStaticMarkup(
      <Tooltip content="Duplicates the order" defaultOpen>
        <Button aria-describedby="err">Copy</Button>
      </Tooltip>,
    ),
  closedDefault: () =>
    renderToStaticMarkup(
      <Tooltip content="Duplicates the order">
        <Button>Copy</Button>
      </Tooltip>,
    ),
};
