# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM build AS test
CMD ["npm", "test"]

FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/PROMPT_CHAT.md /app/PROMPT_QUIZ.md /app/PROMPT_DASHBOARD_INSIGHTS.md ./
COPY --from=build /app/drizzle ./drizzle

RUN mkdir -p /app/uploads /var/logibots/uploads/rag \
  && chown -R node:node /app/uploads /var/logibots

USER node

EXPOSE 43187

CMD ["node", "dist/server.js"]
