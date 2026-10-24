import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "../../src/states/empty-state/empty-state.js";

export const html = {
  emptyIcon: (icon: "inbox" | "search" | "lock" | "none", size?: "sm") =>
    renderToStaticMarkup(
      <EmptyState
        title="Nada"
        size={size}
        icon={icon === "none" ? undefined : icon}
        description="Aún no hay datos"
        action={<b data-action />}
      />,
    ),
};
