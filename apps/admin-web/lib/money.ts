const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Importe abreviado para gráficos y tarjetas: "$2,4 M", "$640 mil" o "$900". */
export const compactMoney = (amount: number) => {
  if (amount >= 1_000_000)
    return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} M`;
  if (amount >= 1_000)
    return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount / 1_000)} mil`;
  return ars.format(amount);
};
