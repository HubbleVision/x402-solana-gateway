FROM node:22-alpine AS base

FROM base AS builder

RUN apk add --no-cache gcompat
WORKDIR /app

COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm install -g pnpm && \
    pnpm install && \
    pnpm run build && \
    pnpm prune --production

FROM base AS runner
WORKDIR /app

# Add build argument for NODE_ENV
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/src /app/src
COPY --from=builder --chown=hono:nodejs /app/public /app/public
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

USER hono
EXPOSE 3000

CMD ["npx", "tsx", "--env-file=.env", "/app/src/server/simplified.ts"]