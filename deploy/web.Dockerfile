# Admin web (Next.js). Se construye desde la raíz del repositorio para conservar npm workspaces:
#   docker build -f deploy/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=... .
FROM node:22-bookworm-slim

WORKDIR /app

# Next incorpora NEXT_PUBLIC_* durante el build: cambiar la URL exige reconstruir la imagen.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN npm ci --include=dev \
  && npm run build --workspace=@academy/admin-web

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@academy/admin-web"]
