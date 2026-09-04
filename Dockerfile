# Multi-stage build for optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# The builder needs Vite, TypeScript and the React plugin from devDependencies.
# Skip local Git-hook installation; the final stage still contains only dist/.
# `deno` (devDependency, solo para `deno check` de edge functions en CI) rechaza musl
# en su postinstall y rompe `npm ci` sobre Alpine. El build sólo necesita Vite,
# TypeScript y el plugin de React, ninguno con postinstall obligatorio.
RUN HUSKY=0 npm ci --ignore-scripts

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built app to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
