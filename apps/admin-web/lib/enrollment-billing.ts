import type { EnrollmentDto, TariffDto } from '@academy/contracts';
import { money } from './money';

/** Modalidades que se pueden elegir: tarifas activas de la clase que siguen vigentes hoy. */
export const modalityOptions = (tariffs: readonly TariffDto[], classId: string, today: string) =>
  tariffs
    .filter(
      (tariff) =>
        tariff.classId === classId &&
        tariff.status === 'ACTIVE' &&
        (!tariff.validTo || tariff.validTo >= today),
    )
    .sort((left, right) => Number(right.amount) - Number(left.amount))
    .map((tariff) => ({ id: tariff.id, label: `${tariff.name} · ${money(tariff.amount)}` }));

/** Resumen de las condiciones de cobro de la inscripción para la ficha. */
export const billingTermsLabel = (enrollment: Pick<EnrollmentDto, 'tariff' | 'paymentDueDay'>) =>
  `${
    enrollment.tariff
      ? `${enrollment.tariff.name} (${money(enrollment.tariff.amount)})`
      : 'Tarifa de la clase'
  } · paga el día ${enrollment.paymentDueDay}`;
