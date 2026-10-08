// Inline <head> script shared by the landing page and the docs (Starlight `head`).
// It restores the visitor's look before first paint so there is no flash:
//   - theme: Starlight's own `starlight-theme` key ("dark" | "light" | "" for auto)
//   - preset: `ui-site:preset` = { style, accent, density, radius } (data-* attributes on <html>)
// Everything is wrapped in try/catch because storage can be blocked.
export const PRESET_STORAGE_KEY = "ui-site:preset";
export const THEME_STORAGE_KEY = "starlight-theme";

export const presetInitScript = `(function(){try{
var d=document.documentElement;
var t=localStorage.getItem("${THEME_STORAGE_KEY}");
if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}
d.dataset.theme=t;
var p=JSON.parse(localStorage.getItem("${PRESET_STORAGE_KEY}")||"{}");
["style","accent","density","radius"].forEach(function(k){if(p[k])d.dataset[k]=p[k]});
}catch(e){}})();`;
