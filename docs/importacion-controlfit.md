# Importación histórica de ControlFit

Los cobros de cuota del reporte `ReporteMovimientosDeCajaDetallado.xlsx` de ControlFit se importan en dos pasos, siempre desde la raíz:

```bash
node scripts/analyze-june-2026-payments.mjs          # solo lectura: genera exports/june-oct-2026-payments-analysis.json
node scripts/import-controlfit-payments.mjs          # simulación: exports/controlfit-payment-import-report.{json,xlsx}
CONTROLFIT_IMPORT_CONFIRM=<base> node scripts/import-controlfit-payments.mjs --apply
```

Requiere la migración `20261024120000_controlfit_payment_import` aplicada y `CONTROLFIT_IMPORT_USERNAME` con un usuario administrativo activo. Las equivalencias de actividades se editan en `scripts/controlfit-class-mapping.json` y exigen volver a correr el análisis. El reporte separa importables y excluidos con su motivo; las reglas están en `docs/decisions.md` (147–154). La importación es idempotente y no crea movimientos de Caja.
