# Despliegue en VPS (OVHcloud)

Producción corre en un VPS con Docker Compose. La base de datos sigue en Neon.

```text
Navegador ──HTTPS──► Caddy (VPS, puertos 80/443)
                       ├── /api/*  → api  (NestJS, puerto interno 3001) ──► Neon (PostgreSQL, us-east-1)
                       └── resto   → web  (Next.js, puerto interno 3000)
```

- Dominio: `gestion.academiacarmesi.com.ar`. El panel y la API comparten origen, por eso la cookie de sesión usa `SameSite=Lax` y no depende de cookies de terceros.
- Caddy obtiene y renueva el certificado HTTPS automáticamente.
- La API y el panel no publican puertos: sólo se llega a ellos a través de Caddy.
- Los archivos están en `deploy/`. Render sigue disponible como respaldo hasta darlo de baja.

Horario de la academia: lunes a sábado de 15 a 23 h. Los despliegues y tareas de mantenimiento se hacen fuera de ese horario (mañanas o domingos).

## 1. Primer acceso al servidor

OVH envía por mail la IP y una contraseña temporal para el usuario `ubuntu`. Desde la PC (PowerShell o Git Bash):

```bash
ssh ubuntu@IP_DEL_VPS
```

Actualizar el sistema:

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

## 2. Acceso con clave SSH (sin contraseña)

En la PC, si todavía no existe una clave:

```bash
ssh-keygen -t ed25519 -C "vps-academia"
```

Copiar la clave pública al servidor. En Git Bash:

```bash
ssh-copy-id ubuntu@IP_DEL_VPS
```

En PowerShell, si no hay `ssh-copy-id`:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@IP_DEL_VPS "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Comprobar que `ssh ubuntu@IP_DEL_VPS` entra **sin pedir contraseña**. Recién entonces, en el servidor, deshabilitar el acceso por contraseña y el de root:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
EOF
sudo systemctl restart ssh
```

Antes de cerrar la sesión, abrir otra terminal y verificar que el acceso con clave sigue funcionando.

## 3. Firewall y actualizaciones automáticas

```bash
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades   # responder "Yes"
```

## 4. Instalar Docker

Seguir la instalación oficial para Ubuntu (repositorio `apt` de Docker):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Salir y volver a entrar por SSH para que el grupo `docker` tenga efecto. Comprobar con `docker compose version`.

## 5. Descargar el repositorio

El repositorio es privado: se usa una **deploy key** de sólo lectura.

```bash
ssh-keygen -t ed25519 -C "vps-academia-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

En GitHub: repositorio → **Settings → Deploy keys → Add deploy key**, pegar la clave y dejar **sin** marcar "Allow write access". Luego:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
EOF
git clone git@github.com:ulises-ayala/gestion-academia.git ~/gestion-academia
```

## 6. Variables de entorno

```bash
cd ~/gestion-academia/deploy
cp .env.example .env
chmod 600 .env
nano .env
```

- `APP_DOMAIN`: `gestion.academiacarmesi.com.ar`.
- `DATABASE_URL`: cadena de Neon con el host **pooled** (contiene `-pooler`). En el panel de Neon: **Connect** → activar "Connection pooling".
- `DIRECT_URL`: misma cadena con el host **directo** (sin `-pooler`). Prisma la usa para las migraciones.
- Si la contraseña de Neon contiene `$`, escribirlo como `$$` (Docker Compose interpreta `$`).

## 7. DNS

En Cloudflare → **DNS → Records**, crear:

| Type | Name      | IPv4 address | Proxy status             |
| ---- | --------- | ------------ | ------------------------ |
| `A`  | `gestion` | IP del VPS   | DNS only (nube **gris**) |

Comprobar desde la PC que `nslookup gestion.academiacarmesi.com.ar` devuelve la IP del VPS **antes** del primer arranque: Caddy necesita que el dominio apunte al servidor para emitir el certificado.

## 8. Primer arranque

```bash
cd ~/gestion-academia/deploy
docker compose up -d --build
docker compose logs -f api   # confirmar que prisma migrate deploy terminó y la API inició
```

La primera compilación tarda varios minutos. Verificar:

- `https://gestion.academiacarmesi.com.ar/api/v1/health` responde `{"status":"ok","service":"academy-api"}`.
- `https://gestion.academiacarmesi.com.ar` muestra el login; iniciar y cerrar sesión.
- `docker compose ps` muestra los tres servicios en ejecución y `api` como `healthy`.

## 9. Respaldo diario de la base

`deploy/backup-db.sh` guarda un `pg_dump` de Neon en el VPS (por defecto en `/var/backups/academy`, 30 días). Es una copia en otro proveedor, independiente del historial corto del plan gratuito de Neon.

```bash
sudo mkdir -p /var/backups/academy && sudo chown ubuntu /var/backups/academy
chmod +x ~/gestion-academia/deploy/backup-db.sh
~/gestion-academia/deploy/backup-db.sh        # probar una vez
crontab -e
```

Agregar esta línea (todos los días a las 7:00 UTC, 4:00 en Argentina):

```cron
0 7 * * * /home/ubuntu/gestion-academia/deploy/backup-db.sh >> /home/ubuntu/backup-db.log 2>&1
```

Para llevar una copia a la PC:

```bash
scp ubuntu@IP_DEL_VPS:/var/backups/academy/academy-AAAAMMDDTHHMMSSZ.dump .
```

Restaurar **sólo en una base vacía o descartable** (nunca encima de producción sin una decisión explícita):

```bash
pg_restore --no-owner --dbname="postgresql://.../base_destino" academy-AAAAMMDDTHHMMSSZ.dump
```

Probar una restauración al menos una vez, por ejemplo en una rama nueva de Neon.

## 10. Actualizar a una nueva versión

Fuera del horario de la academia:

```bash
cd ~/gestion-academia
git pull
cd deploy
docker compose up -d --build
docker compose logs -f api
docker image prune -f        # libera imágenes viejas
```

La API aplica las migraciones pendientes al arrancar (`prisma migrate deploy`, incremental y sin reset). Si una migración falla, la API no inicia: revisar el log y corregir la migración. Nunca usar `migrate dev`, `db push` ni reset contra producción.

## Problemas frecuentes

- **El certificado HTTPS no se emite:** el registro DNS no apunta todavía a la IP, está con la nube naranja de Cloudflare o los puertos 80/443 están cerrados. Revisar `docker compose logs caddy`.
- **El panel intenta conectarse a otra URL:** `NEXT_PUBLIC_API_URL` se fija al compilar a partir de `APP_DOMAIN`; tras cambiar el dominio, reconstruir con `docker compose up -d --build`.
- **La API no inicia:** revisar `docker compose logs api`. Lo habitual es una `DATABASE_URL` o `DIRECT_URL` mal copiada.
- **Falta memoria al compilar:** agregar swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`).
