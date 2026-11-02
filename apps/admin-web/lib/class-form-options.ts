export type FormOption = Readonly<{ id: string; label: string }>;

/**
 * Las listas del formulario solo traen tipos de danza y profesores activos. Al editar una
 * clase cuyo profesor o danza se desactivó, se lo agrega marcado para que se vea y se pueda
 * cambiar, en lugar de que el desplegable muestre otro valor.
 */
export const withCurrentOption = (
  options: readonly FormOption[],
  current: FormOption | null,
): readonly FormOption[] =>
  !current || options.some((option) => option.id === current.id)
    ? options
    : [{ id: current.id, label: `${current.label} (inactivo)` }, ...options];

/**
 * Opciones de "Otros profesores": los activos menos el responsable, más los adicionales actuales
 * que se desactivaron (marcados, para poder quitarlos).
 */
export const additionalTeacherOptions = (
  options: readonly FormOption[],
  current: readonly FormOption[],
  responsibleId: string,
): readonly FormOption[] =>
  [
    ...current
      .filter((item) => !options.some((option) => option.id === item.id))
      .map((item) => ({ id: item.id, label: `${item.label} (inactivo)` })),
    ...options,
  ].filter((option) => option.id !== responsibleId);

/** La clase se abre directamente en edición con `?editar=1` (enlace "Editar" del listado). */
export const opensInEditMode = (search: string) =>
  new URLSearchParams(search).get('editar') === '1';
