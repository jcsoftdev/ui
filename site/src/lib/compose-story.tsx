import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";

// A tiny CSF3 composer: meta args + story args, `render`, and decorators (story first, then meta).
// It covers what the library's stories use without pulling Storybook's runtime into the site.

type Decorator = (Story: ComponentType, context: Record<string, unknown>) => ReactElement;

interface Csf {
  args?: Record<string, unknown>;
  render?: (args: Record<string, unknown>, context: Record<string, unknown>) => ReactNode;
  decorators?: Decorator[];
  parameters?: Record<string, unknown>;
  name?: string;
}
interface Meta extends Csf {
  title?: string;
  component?: ComponentType<Record<string, unknown>>;
}
export type StoryModule = { default: Meta } & Record<string, unknown>;

const sanitize = (v: string) =>
  v
    .toLowerCase()
    .replace(/[ '–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const words = (key: string) =>
  key.match(/[A-Z]{2,}(?=[A-Z][a-z]|\b|\d)|[A-Z]?[a-z]+|[A-Z]+|\d+/g) ?? [key];

export function composeStory(mod: StoryModule, exportName: string) {
  const meta = mod.default;
  const story = (mod[exportName] ?? {}) as Csf;
  const args = { ...meta.args, ...story.args };
  const context = {
    args,
    argTypes: {},
    globals: {},
    loaded: {},
    viewMode: "story",
    parameters: { ...meta.parameters, ...story.parameters },
    title: meta.title,
    name: story.name ?? exportName,
    id: "",
  };
  const render = story.render ?? meta.render;
  const Base: ComponentType = () => {
    if (render) return render(args, context) as ReactElement;
    if (!meta.component) return null;
    return createElement(meta.component, args);
  };
  // Story decorators wrap closest to the story, meta decorators outside them.
  const decorators = [...(story.decorators ?? []), ...(meta.decorators ?? [])];
  const Story = decorators.reduce<ComponentType>((Inner, decorate) => {
    const Wrapped: ComponentType = () => decorate(Inner, context);
    return Wrapped;
  }, Base);
  const id = meta.title
    ? `${sanitize(meta.title)}--${sanitize(
        words(exportName)
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" "),
      )}`
    : null;
  return { Story, id };
}
