# Builds the Angular app and serves it with Caddy, which also proxies /api to the Prod and Demo APIs.
# The Caddyfile and certificates are mounted at run time (see qr-menu-api/deploy).
FROM node:25-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM caddy:2-alpine
COPY --from=build /src/dist/web/browser /srv/web
