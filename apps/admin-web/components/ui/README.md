# Bases visuales del panel

Fases 1 y 2: adopción incremental, sin cambiar reglas, rutas ni textos funcionales.

- Los valores visuales viven en `app/tokens.css`. `data-theme` y su persistencia siguen a cargo del shell existente. No agregar colores locales.
- `Button` usa el botón nativo y las clases existentes. Variantes: `primary`, `secondary`, `ghost`, `destructive`; tamaño normal o `small`. Por defecto es `type="button"`: indicar `type="submit"` en formularios. `loading` deshabilita el botón y anuncia `aria-busy`; el consumidor conserva el texto de progreso existente. Un botón sólo con icono debe tener `aria-label`. Para navegar, conservar enlaces reales.
- `Input`, `Select`, `Textarea`: controles nativos con `id` único, `label`, `helpText` y `error`. Reenvían atributos, eventos y refs de React 19. No validan ni transforman valores. Vinculan ayuda/error mediante `aria-describedby`, conservando descripciones externas. El error también establece `aria-invalid`.
- `Badge`: recibe el texto traducido existente y un tono visual; no conoce enums de negocio. No usar sólo un color para comunicar estado.
- `Panel`: reutiliza `.card`, sin margen externo; el contenedor decide el espaciado. Usar `aria-labelledby` cuando corresponda.
- `EmptyState`: recibe contenido/acciones existentes; no inventa mensajes ni acciones.
- `Skeleton`: placeholder decorativo estático, oculto al árbol accesible. El contenedor debe conservar el mensaje de carga y `aria-busy` correspondientes. No agrega animaciones.

La integración inicial se limita a los controles de `EndEnrollmentModal`. Se conserva el diálogo nativo, apertura/cierre, restauración del foco, cancelación, validaciones y envío existentes. Tablas, checkbox/radio y demás controles actuales ya reciben la base CSS; no se reemplazan por widgets personalizados.

No se agrega un segundo sistema de modales, toasts, paginación o tabs. Su extracción se evaluará al adoptar las bases en cada pantalla. `PageHeader`, shell, iconos y responsive estructural corresponden a fase 3. No se instaló un framework de estilos ni una dependencia nueva.
