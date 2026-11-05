# Base images are arguments so the ASIN pipeline can point them at the Harbor mirror (no direct Docker Hub pull in production).
ARG NODE_IMAGE=node:22.23-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Unprivileged nginx (port 8080, non-root): serves the SPA and proxies /api to the API on the same origin,
# so the refresh cookie stays first-party and SameSite=Strict.
FROM ${NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
