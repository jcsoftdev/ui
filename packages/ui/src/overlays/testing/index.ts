/**
 * Test-only helpers for overlays, kept off the main `@jcsoftdev/ui/overlays` entry so production
 * bundles never carry them: `import { resetToasts } from "@jcsoftdev/ui/overlays/testing"`.
 */
export { reset as resetToasts } from "../toaster/toast-store.js";
