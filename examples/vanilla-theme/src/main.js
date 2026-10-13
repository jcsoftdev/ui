import "@jcsoftdev/ui-tokens/styles/tokens.css";
import "@jcsoftdev/ui-tokens/styles/base.css";
import { auditTheme, contrastRatio, createTheme } from "@jcsoftdev/ui-tokens";
import { applyTheme } from "@jcsoftdev/ui-tokens/dom";
import "./style.css";

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
let dispose = () => {};

function seeds() {
  const pick = (name) => ($(`${name}-on`).checked ? $(name).value : undefined);
  return {
    brand: $("brand").value,
    accent: pick("accent"),
    neutral: pick("neutral"),
    danger: pick("danger"),
    contrast: "AA",
  };
}

function render() {
  const theme = createTheme(seeds());
  dispose();
  dispose = applyTheme(theme, root);
  $("brand-hex").textContent = $("brand").value;

  const violations = auditTheme(theme);
  $("audit").textContent = violations.length
    ? `${violations.length} contrast violations`
    : "All foreground/background pairs meet WCAG AA (light and dark)";
  $("audit").dataset.ok = String(violations.length === 0);

  const scheme = $("scheme").value;
  if (scheme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", scheme);

  const current = root.getAttribute("data-theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const value = (t) => t.value[current];
  const byName = Object.fromEntries(theme.color.tokens.map((t) => [t.name, t]));
  const bg = value(byName.surface);

  $("bars").replaceChildren(
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => {
      const bar = document.createElement("span");
      bar.className = "bar-i";
      bar.style.height = `${24 + ((n * 37) % 56)}px`;
      bar.style.background = `var(--chart-cat-${n})`;
      return bar;
    }),
  );

  $("tokens").replaceChildren(
    ...theme.color.tokens
      .filter((t) => /^#/.test(value(t)))
      .map((t) => {
        const el = document.createElement("div");
        el.className = "tok";
        el.innerHTML = `<i style="background:var(--${t.name})"></i><b></b><small></small>`;
        el.querySelector("b").textContent = t.name;
        el.querySelector("small").textContent = `${value(t)} ${contrastRatio(value(t), bg).toFixed(1)}:1`;
        return el;
      }),
  );
}

for (const id of ["brand", "accent", "neutral", "danger", "accent-on", "neutral-on", "danger-on", "scheme"]) {
  $(id).addEventListener("input", render);
}
render();
