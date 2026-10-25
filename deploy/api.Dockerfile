# API (NestJS). Se construye desde la raíz del repositorio para conservar npm workspaces:
#   docker build -f deploy/api.Dockerfile .
FROM node:22-bookworm-slim

# Prisma necesita OpenSSL para conectarse a PostgreSQL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# Igual que en Render: --include=dev conserva el CLI de Prisma, necesario para migrar al arrancar.
RUN npm ci --include=dev \
  && npm run db:generate \
  && npm run build --workspace=@academy/api

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Aplica las migraciones pendientes (idempotente, sin reset) y luego inicia la API.
CMD ["sh", "-c", "npm run db:deploy && npm run start --workspace=@academy/api"]
