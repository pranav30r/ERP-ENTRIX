# ====================================================================
# ENTRIX ERP Frontend SPA - Production Container Image
# ====================================================================

FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
RUN npm ci

COPY public ./public
COPY src ./src
RUN npm run build

# ====================================================================
FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
