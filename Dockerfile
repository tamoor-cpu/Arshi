# ---- Stage 1: build the React client ----
# Full node image (not slim) so native postinstall steps have build tools available.
FROM node:20 AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# ---- Stage 2: server runtime (serves the API + the built client) ----
FROM node:20 AS server
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npx prisma generate
# Bring in the built client so Express can serve it (index.js expects ../../client/build)
COPY --from=client /app/client/build /app/client/build
EXPOSE 4000
CMD ["node", "src/index.js"]
