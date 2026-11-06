# Respaldos de la base de producción

La base de producción (Neon) se respalda **cada 3 días** con el workflow
[`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml), sin depender de ninguna
computadora prendida:

- Corre a las 03:00 (hora de Buenos Aires) los días 1, 4, 7, … de cada mes. También se puede
  correr a mano desde GitHub → **Actions** → **Respaldo de la base** → **Run workflow**.
- Hace un `pg_dump` completo (formato custom de PostgreSQL 16), verifica que se pueda leer y lo
  **cifra con AES-256** antes de subirlo. Nunca se guarda sin cifrar.
- El archivo cifrado queda como artefacto del workflow durante **90 días** (unos 30 respaldos).
- Si falla, GitHub avisa por mail a quien configuró el repositorio.

Los respaldos tienen datos reales de alumnos: no se commitean ni se comparten (ver `.gitignore`).

## Configuración (una sola vez)

En GitHub → el repositorio → **Settings → Secrets and variables → Actions → New repository
secret**, crear dos secretos:

| Secreto               | Valor                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `BACKUP_DATABASE_URL` | La cadena de conexión de Neon **directa** (el host **sin** `-pooler`) con `?sslmode=require`. La misma base que usa Render.      |
| `BACKUP_PASSPHRASE`   | Una contraseña larga para cifrar los respaldos. Guardala en un lugar seguro: **sin ella no se puede restaurar ningún respaldo**. |

Es la única excepción a "las credenciales viven solo en Render": el respaldo corre en GitHub y
necesita leer la base. Si se cambia la contraseña de Neon, hay que actualizar este secreto.

Después, correr el workflow a mano una vez y revisar que termine en verde y que aparezca el
artefacto `carmesi-AAAA-MM-DD_HHMM`.

## Restaurar un respaldo

**Nunca se restaura sobre Neon** sin decidirlo antes: primero se restaura en la base local para
revisarlo.

1. En GitHub → **Actions** → **Respaldo de la base** → la corrida → **Artifacts**, descargar el
   respaldo y descomprimir el `.zip`: queda `carmesi-AAAA-MM-DD_HHMM.dump.gpg`.
2. Descifrar (pide `BACKUP_PASSPHRASE`; en Windows, `gpg` viene con Git Bash o Gpg4win):

   ```bash
   gpg --output carmesi.dump --decrypt carmesi-AAAA-MM-DD_HHMM.dump.gpg
   ```

3. Restaurar en el Postgres local de Docker (`docker compose up -d db`), en una base nueva:

   ```bash
   docker compose exec -T db createdb -U academy academy_restore
   docker compose exec -T db pg_restore -U academy -d academy_restore --no-owner --no-privileges < carmesi.dump
   ```

4. Para usarla, apuntar `DATABASE_URL` del `.env` a `localhost/academy_restore` y levantar
   `npm run dev`. Al terminar, borrar `carmesi.dump` (tiene datos reales).

Conviene probar una restauración cada tanto (por ejemplo, una vez por mes): un respaldo que nunca
se restauró no está probado.
