FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003
ENV HOST=0.0.0.0

COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node data/builtin ./data/builtin

USER node

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3003) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server/index.mjs"]

