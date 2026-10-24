import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../../src/atoms/button/button.js";
import { IconButton } from "../../src/atoms/icon-button/icon-button.js";

type Size = "sm" | "md";

export const html = {
  button: (size?: Size) => renderToStaticMarkup(<Button size={size}>Save</Button>),
  iconButton: (size?: Size) =>
    renderToStaticMarkup(
      <IconButton label="More" size={size}>
        <svg />
      </IconButton>,
    ),
};
