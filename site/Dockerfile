# Build context is the repository root:  docker build -f site/Dockerfile .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY site/package.json site/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ui packages/ui
COPY site site
# The site imports the UI package from its dist output and the docs generator reads its source,
# so the library is built first. The site build then generates the docs and renders everything.
RUN pnpm --filter @jcsoftdev/ui build
# Public origin and Storybook location, baked into links and canonical URLs at build time.
ARG SITE_URL=
ARG PUBLIC_STORYBOOK_URL=/storybook/
ENV SITE_URL=$SITE_URL PUBLIC_STORYBOOK_URL=$PUBLIC_STORYBOOK_URL ASTRO_TELEMETRY_DISABLED=1
RUN pnpm --filter @jcsoftdev/ui-site build
# Storybook is served by the same image under /storybook/ as the full component workbench.
RUN pnpm --filter @jcsoftdev/ui build-storybook --output-dir /repo/site/dist/storybook

# Unprivileged nginx: runs as uid 101 and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/site/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1:8080/llms.txt || exit 1
