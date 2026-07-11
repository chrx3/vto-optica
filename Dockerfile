# Etapa 1: build
FROM node:20-alpine AS build
WORKDIR /app

# Copiar package files y instalar deps (cacheable)
COPY package*.json ./
RUN npm ci

# Copiar código y buildear
COPY . .
RUN npm run build

# Etapa 2: runtime (Nginx para servir estáticos)
FROM nginx:alpine

# Copiar build
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración Nginx con SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]