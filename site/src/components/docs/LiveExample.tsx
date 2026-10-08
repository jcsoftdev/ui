import { Component, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { composeStory, type StoryModule } from "../../lib/compose-story";

// Every Storybook file of the library, loaded lazily: a docs page only downloads its own story module.
const storyModules = import.meta.glob("../../../../packages/ui/src/**/*.stories.tsx") as Record<
  string,
  () => Promise<StoryModule>
>;

const WIDTHS = [
  { label: "320", value: 320 },
  { label: "480", value: 480 },
  { label: "768", value: 768 },
  { label: "Full", value: 0 },
] as const;

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <p role="alert" style={{ color: "var(--danger, #b00020)", fontSize: 13 }}>
          This example could not render: {this.state.error.message}
        </p>
      );
    }
    return this.props.children;
  }
}

interface Props {
  /** Path of the stories file relative to packages/ui/src. */
  file: string;
  /** Export name of the story to render. */
  story: string;
  name: string;
  storybookUrl: string;
}

export default function LiveExample({ file, story, name, storybookUrl }: Props) {
  const [Story, setStory] = useState<ComponentType | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = storyModules[`../../../../packages/ui/src/${file}`];
    if (!load) {
      setFailed(`Stories file not found: ${file}`);
      return;
    }
    load()
      .then((mod) => {
        if (cancelled) return;
        const composed = composeStory(mod, story);
        setStory(() => composed.Story);
        setStoryId(composed.id);
      })
      .catch((error: unknown) => !cancelled && setFailed(String(error)));
    return () => {
      cancelled = true;
    };
  }, [file, story]);

  const storybookHref = useMemo(
    () => (storyId ? `${storybookUrl.replace(/\/$/, "")}/?path=/story/${storyId}` : null),
    [storybookUrl, storyId],
  );

  return (
    <section className="ui-example not-content" aria-label={`${name} live example`}>
      <div className="ui-example__bar">
        <strong style={{ color: "var(--ink)" }}>Live preview</strong>
        <span aria-hidden="true">container</span>
        <div role="group" aria-label="Container width" style={{ display: "flex", gap: 4 }}>
          {WIDTHS.map((w) => (
            <button
              key={w.label}
              type="button"
              aria-pressed={width === w.value}
              onClick={() => setWidth(w.value)}
              style={{
                height: 24,
                padding: "0 8px",
                borderRadius: 999,
                border: "1px solid var(--line-strong)",
                background: width === w.value ? "var(--accent)" : "transparent",
                color: width === w.value ? "var(--on-accent)" : "var(--ink-2)",
                font: "inherit",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
        {storybookHref ? (
          <a href={storybookHref} style={{ marginLeft: "auto", color: "var(--accent-ink)" }}>
            Open in Storybook
          </a>
        ) : null}
      </div>
      <div className="ui-example__stage">
        <div className="ui-example__canvas" style={{ width: width ? width : "100%" }}>
          {failed ? (
            <p role="alert" style={{ fontSize: 13 }}>
              {failed}
            </p>
          ) : Story ? (
            <Boundary>
              <Story />
            </Boundary>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading example…</p>
          )}
        </div>
      </div>
    </section>
  );
}
