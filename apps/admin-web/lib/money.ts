const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Importe en pesos con centavos: "$ 40.000,00". */
export const money = (value: string | number) => pesos.format(Number(value));

/** Importe en pesos sin centavos, para números grandes de resumen: "$ 912.000". */
export const moneyRounded = (value: string | number) => ars.format(Number(value));

/** Importe abreviado para gráficos y tarjetas: "$2,4 M", "$640 mil" o "$900". */
export const compactMoney = (amount: number) => {
  if (amount >= 1_000_000)
    return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} M`;
  if (amount >= 1_000)
    return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount / 1_000)} mil`;
  return ars.format(amount);
};
