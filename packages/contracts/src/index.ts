/** Decimal monetary values cross the API boundary as strings to preserve precision. */
export type MoneyDto = Readonly<{ amount: string; currency: string }>;

export type ApiErrorDto = Readonly<{
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  traceId?: string;
}>;
