// The toast store and `toast` facade are plain modules: no DOM needed.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  stdin: {
    contents: `export * as store from "./toast-store.ts"; export { toast } from "./toast.ts";`,
    resolveDir: join(here, "../src/overlays/toaster"),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  external: ["react"],
  write: false,
});
const { store, toast } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

beforeEach(() => store.reset());

test("toast returns ids and stacks in order with the right tone", () => {
  const a = toast("one");
  const b = toast.success("two");
  const c = toast.error("three");
  assert.notEqual(a, b);
  assert.deepEqual(
    store.getSnapshot().map((t) => [t.id, t.message, t.tone]),
    [
      [a, "one", "default"],
      [b, "two", "success"],
      [c, "three", "error"],
    ],
  );
});

test("an existing id updates in place, bumps the revision and reopens", () => {
  toast("first", { id: "x" });
  toast("other");
  toast.dismiss("x");
  assert.equal(store.getSnapshot()[0].state, "closed");
  toast.success("second", { id: "x", description: "d" });
  const [x, other] = store.getSnapshot();
  assert.equal(store.getSnapshot().length, 2);
  assert.deepEqual(
    [x.id, x.message, x.tone, x.state, x.revision, x.description],
    ["x", "second", "success", "open", 2, "d"],
  );
  assert.equal(other.message, "other");
});

test("dismiss closes one or all, is idempotent and fires onDismiss once", () => {
  const seen = [];
  const a = toast("a", { onDismiss: (id) => seen.push(id) });
  toast("b");
  toast.dismiss(a);
  toast.dismiss(a);
  assert.deepEqual(seen, [a]);
  assert.deepEqual(
    store.getSnapshot().map((t) => t.state),
    ["closed", "open"],
  );
  toast.dismiss();
  assert.deepEqual(
    store.getSnapshot().map((t) => t.state),
    ["closed", "closed"],
  );
});

test("remove drops only the named toast", () => {
  const a = toast("a");
  const b = toast("b");
  store.remove(a);
  assert.deepEqual(
    store.getSnapshot().map((t) => t.id),
    [b],
  );
  store.remove("missing");
  assert.equal(store.getSnapshot().length, 1);
});

test("selectVisible keeps the newest N open toasts and every closing one", () => {
  const ids = [toast("1"), toast("2"), toast("3")];
  toast.dismiss(ids[1]);
  const ordered = store.selectVisible(store.getSnapshot(), 1).map((t) => t.message);
  assert.deepEqual(ordered, ["2", "3"]);
  assert.deepEqual(
    store.selectVisible(store.getSnapshot(), 2).map((t) => t.message),
    ["1", "2", "3"],
  );
});

test("subscribers are notified on change and stop after unsubscribe; server snapshot is empty", () => {
  let calls = 0;
  const off = store.subscribe(() => calls++);
  toast("a");
  toast.dismiss();
  assert.equal(calls, 2);
  off();
  toast("b");
  assert.equal(calls, 2);
  assert.equal(store.getServerSnapshot().length, 0);
});

test("toasts published before anything subscribes are kept", () => {
  toast("early");
  assert.equal(store.getSnapshot().length, 1);
});
