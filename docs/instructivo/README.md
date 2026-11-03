# Instructivo por rol

`instructivo.md` es el instructivo de la academia (Admisión, Administración y Dirección) y `capturas/` tiene sus imágenes. Se actualiza junto con cada funcionalidad nueva.

## Actualizarlo

1. Editar `instructivo.md` (títulos, párrafos, listas, tablas, notas con `>` e imágenes solas en su línea).
2. Regenerar las capturas con la app **local** y el seed de desarrollo (base `academy` en localhost; nunca contra Neon ni producción):

   ```bash
   npm run db:seed           # base local recién migrada
   npm run dev               # API y panel
   node scripts/instructivo-capturas.mjs
   ```

   El script carga unos datos de ejemplo por la API (un cobro con saldo a favor, un alumno eventual y un potencial alumno con clase de prueba) y saca las capturas con Chrome. Conviene correrlo sobre una base recién sembrada. Si una pantalla cambia de textos, hay que ajustar el paso correspondiente del script.

3. Armar el PDF para la academia:

   ```bash
   node scripts/instructivo-pdf.mjs ../Instructivo-Carmesi.pdf
   ```

Los dos scripts usan el Chrome instalado (`CHROME_PATH` para otro) y no agregan dependencias.
