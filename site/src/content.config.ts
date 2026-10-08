import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection, z } from "astro:content";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** Library category of a generated component page (atoms, charts, ...). */
        category: z.string().optional(),
        componentSlug: z.string().optional(),
        importPath: z.string().optional(),
        /** Story rendered as the live example of a component page. */
        example: z.object({ file: z.string(), story: z.string() }).optional(),
        /** Section of llms.txt this page belongs to (guides only; components use their category). */
        section: z.string().optional(),
      }),
    }),
  }),
};
