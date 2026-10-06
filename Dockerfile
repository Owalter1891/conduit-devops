FROM node:24-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

FROM manifests AS frontend-build
RUN npm ci
COPY frontend/ ./frontend/
RUN npm run build --workspace frontend

FROM manifests AS production-dependencies
RUN npm ci --omit=dev --workspace backend

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/backend
COPY --from=production-dependencies /app/node_modules /app/node_modules
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 3001
CMD ["node", "index.js"]
