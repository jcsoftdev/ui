import { renderToStaticMarkup } from "react-dom/server";
import { ActionBar } from "../../src/containers/action-bar/action-bar.js";
import { Card } from "../../src/containers/card/card.js";
import { Topbar } from "../../src/shell/topbar/topbar.js";
import { cn } from "../../src/utils/cn.js";
import { materialClass } from "../../src/utils/material.js";

const classOf = (markup: string) => /class="([^"]*)"/.exec(markup)?.[1] ?? "";

export const material = {
  cn,
  materialClass,
  card: (m?: "solid" | "glass" | "glass-clear") => classOf(renderToStaticMarkup(<Card material={m} />)),
  cardClassName: () => classOf(renderToStaticMarkup(<Card className="glass-clear" />)),
  actionBar: (m?: "solid" | "glass" | "glass-clear") =>
    classOf(renderToStaticMarkup(<ActionBar selectedCount={1} material={m} />)),
  topbar: (m?: "solid" | "glass" | "glass-clear") =>
    classOf(
      renderToStaticMarkup(
        <Topbar breadcrumbs={["Home"]} breadcrumbsLabel="Path" onSearch={() => {}} material={m} />,
      ),
    ),
};
