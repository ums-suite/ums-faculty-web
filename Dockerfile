# syntax=docker/dockerfile:1
#
# Builds ums-faculty-web's CSR-only bundle. Two-stage build, mirroring ums-core's own Dockerfile
# rationale: the `build` stage needs the full Node/npm toolchain plus devDependencies (the
# Angular CLI/compiler) to run `ng build`; the `runtime` stage copies only the compiled
# `dist/ums-faculty-web/browser` static output into a slim nginx image, so the final image ships
# neither devDependencies/Node nor the Angular build tooling. Unlike the three SSR apps
# (ums-admission-web/ums-public-web/ums-alumni-web), this app has no `@angular/ssr`/Express server
# to run - it is a pure client-side-routed SPA (no `serve:ssr:*` script in package.json) - so
# nginx serving static files plus a client-side-routing fallback (nginx.conf) is the entire
# runtime, no Node needed at all.
#
# NOTE: unlike the other five repos, this one's own `angular.json` project name is
# "ums-faculty-web" (not "faculty-web") - the dist output path below matches that, not the
# `student-web`/`admin-web` pattern the other two CSR apps use.
#
# API_BASE_URL (build arg): Angular inlines `environment.ts` into the compiled bundle at build
# time - it is not a runtime-configurable value - so this app's API base URL has to be baked in
# here rather than passed as a container env var. Defaults to the browser-reachable
# host-published ums-core port (matches ums-devops's own UMS_CORE_PORT default): since this app
# is CSR-only, every API call originates in the browser, so this is a full, unqualified fix (no
# server-side-fetch caveat like the three SSR apps have).

FROM node:22-alpine AS build
WORKDIR /app

# package*.json + vendor/ first (not the whole source tree) so `npm ci` gets its own cached layer
# - vendor/*.tgz has to come along because package.json pins @ums/design-system and @ums/shared
# as `file:vendor/...tgz` dependencies (this repo's own README "Local package consumption").
COPY package.json package-lock.json ./
COPY vendor/ ./vendor/
RUN npm ci

COPY . .

ARG API_BASE_URL=http://localhost:8080
RUN sed -i "s#apiBaseUrl: '[^']*'#apiBaseUrl: '${API_BASE_URL}'#" src/environments/environment.ts

RUN npm run build

FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ums-faculty-web/browser/ /usr/share/nginx/html/

EXPOSE 80

# nginx:alpine's master process must stay root to bind port 80 and manage its worker processes,
# but the workers that actually serve requests already drop to the image's own unprivileged
# "nginx" user by default - no extra USER directive needed here (unlike the Node-based images in
# this platform's other Dockerfiles, which do need one).
