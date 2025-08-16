# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install OS deps
RUN apk add --no-cache python3 make g++

# Copy manifests and install deps
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then npm i -g yarn && yarn install --frozen-lockfile; \
    else npm i; fi

# Copy source
COPY tsconfig.json ./tsconfig.json
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client and build
RUN npx prisma generate && npm run build

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install tini for signal handling
RUN apk add --no-cache tini curl
ENTRYPOINT ["/sbin/tini", "--"]

# Copy built app and prisma artifacts
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/dist /app/dist

# App port
EXPOSE 3001

# Healthcheck optional (compose has one)
# HEALTHCHECK CMD wget -qO- http://localhost:3001/health || exit 1

# Entrypoint to run migrations and start app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
CMD ["/usr/local/bin/docker-entrypoint.sh"]
