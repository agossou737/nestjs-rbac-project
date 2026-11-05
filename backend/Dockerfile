# Base images are arguments so the ASIN pipeline can point them at the Harbor mirror (no direct Docker Hub pull in production).
ARG NODE_IMAGE=node:22.23-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
# Install scripts stay off (as with npm allowScripts locally): only the native modules the API needs are rebuilt,
# and swagger-ui's telemetry script never runs.
ENV SCARF_ANALYTICS=false DO_NOT_TRACK=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild argon2 @prisma/engines
COPY . .
RUN npx prisma generate && npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production SCARF_ANALYTICS=false DO_NOT_TRACK=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild argon2 @prisma/engines && npm cache clean --force
# prisma/ and src/ are kept for `prisma migrate deploy` and the seed (tsx); the API itself runs from dist/.
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
RUN npx prisma generate
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
