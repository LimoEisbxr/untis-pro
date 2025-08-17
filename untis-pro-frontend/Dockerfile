# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then npm i -g yarn && yarn install --frozen-lockfile; \
    else npm i; fi

COPY . .
# Ensure base is set for API if provided at build time
# e.g. docker build --build-arg VITE_API_BASE=http://localhost:3001
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}
# Also allow enabling developer mode at build time
ARG VITE_ENABLE_DEVELOPER_MODE
ENV VITE_ENABLE_DEVELOPER_MODE=${VITE_ENABLE_DEVELOPER_MODE}

RUN npm run build

# Serve with nginx
FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

# Copy built assets
COPY --from=build /app/dist/ /usr/share/nginx/html

# Nginx config to support SPA routing and proxy /api to backend by default
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
