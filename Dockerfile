# ---- Stage 1: build the React client ----
FROM node:20-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ENV NODE_ENV=production
RUN npm run build

# ---- Stage 2: server runtime (serves the API + the built client) ----
FROM node:20-slim AS server
# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
# Bring in the built client so Express can serve it (index.js expects ../../client/build)
COPY --from=client /app/client/build /app/client/build
EXPOSE 4000
CMD ["node", "src/index.js"]
