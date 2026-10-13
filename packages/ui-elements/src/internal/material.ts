import type { LiquidMaterial } from "./liquid.js";

/** Attributes that configure the material; elements that support `material` observe them. */
export const MATERIAL_ATTRIBUTES = [
  "material",
  "lens",
  "liquid-preset",
  "liquid-refraction",
  "liquid-frost",
  "liquid-profile",
  "liquid-dispersion",
  "liquid-specular",
  "liquid-motion",
  "liquid-interactive",
  "liquid-radius",
] as const;

/**
 * The `material` of an element: nothing for `solid` (the default), the Liquid Glass material for
 * `liquid` / `liquid-clear`. The liquid code (`./liquid.js` and, through it, ui-core's liquid
 * engine) is a lazy chunk: an element that never gets `material="liquid"` never fetches it.
 */
export class Material {
  #handle: LiquidMaterial | undefined;
  #loading = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly surface: () => HTMLElement | null,
    private readonly layerRoot?: () => ParentNode | undefined,
  ) {}

  get liquid(): boolean {
    return /^liquid/.test(this.host.getAttribute("material") ?? "");
  }

  /** Call on connect and on every change of a {@link MATERIAL_ATTRIBUTES} attribute. */
  sync(): void {
    if (!this.liquid || !this.host.isConnected) {
      this.stop();
      return;
    }
    if (this.#handle) {
      this.#handle.update();
      return;
    }
    if (this.#loading) return;
    this.#loading = true;
    import("./liquid.js").then(({ liquidMaterial }) => {
      this.#loading = false;
      const surface = this.surface();
      if (!this.liquid || !this.host.isConnected || !surface || this.#handle) return;
      this.#handle = liquidMaterial(this.host, surface, this.layerRoot?.());
    });
  }

  stop(): void {
    this.#handle?.stop();
    this.#handle = undefined;
  }
}
