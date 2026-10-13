import "@jcsoftdev/ui-tokens/styles/tokens.css";
import "@jcsoftdev/ui-tokens/styles/base.css";
// One entry per element: the page pays only for what it registers.
import { defineButton } from "@jcsoftdev/ui-elements/button";
import { defineCheckbox } from "@jcsoftdev/ui-elements/checkbox";
import { defineDialog } from "@jcsoftdev/ui-elements/dialog";
import { defineInput } from "@jcsoftdev/ui-elements/input";
import { definePopover } from "@jcsoftdev/ui-elements/popover";
import { defineRadioGroup } from "@jcsoftdev/ui-elements/radio-group";
import { defineSwitch } from "@jcsoftdev/ui-elements/switch";
import { defineTabs } from "@jcsoftdev/ui-elements/tabs";
import { defineToast, toast } from "@jcsoftdev/ui-elements/toast";
import { defineTooltip } from "@jcsoftdev/ui-elements/tooltip";
import "./style.css";

for (const define of [
  defineButton,
  defineInput,
  defineCheckbox,
  defineSwitch,
  defineRadioGroup,
  defineDialog,
  definePopover,
  defineTooltip,
  defineTabs,
  defineToast,
])
  define();

const $ = (id) => document.getElementById(id);

$("booking").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  $("result").textContent = JSON.stringify(Object.fromEntries(data));
  toast.success("Booking saved");
});

$("delete").addEventListener("click", () => {
  $("confirm").close();
  toast("Booking deleted", { action: { label: "Undo", onClick: () => toast("Restored") } });
});

$("toast").addEventListener("click", () => toast("Hello from ui-toaster"));

$("make-liquid").addEventListener("click", () => $("liquid").setAttribute("material", "liquid"));
