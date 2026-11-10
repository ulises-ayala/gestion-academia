import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import {
  SITUATIONS,
  addDays,
  chargesLabel,
  daysUntilBirthday,
  parseSituation,
  shortDate,
  templateVariables,
  validateTemplate,
} from './message-template';

describe('mensajes de WhatsApp: plantillas', () => {
  it('reconoce las ocho situaciones y rechaza otras', () => {
    expect(SITUATIONS).toHaveLength(8);
    expect(parseSituation('CHARGE_OVERDUE')).toBe('CHARGE_OVERDUE');
    expect(() => parseSituation('OTRA')).toThrow(DomainError);
  });

  it('encuentra los datos entre llaves sin repetir', () => {
    expect(templateVariables('Hola {nombre} 👋, {nombre}: debés {saldo_vencido}')).toEqual([
      'nombre',
      'saldo_vencido',
    ]);
    expect(templateVariables('Sin datos, con *negrita*')).toEqual([]);
  });

  it('valida nombre, texto y que los datos sean los de la situación', () => {
    expect(validateTemplate({ name: '  Aviso ', body: ' Hola {nombre} 🎂 ' }, 'BIRTHDAY')).toEqual({
      name: 'Aviso',
      body: 'Hola {nombre} 🎂',
    });
    expect(() => validateTemplate({ name: '', body: 'Hola' }, 'BIRTHDAY')).toThrow('nombre');
    expect(() => validateTemplate({ name: 'Aviso', body: '  ' }, 'BIRTHDAY')).toThrow('mensaje');
    expect(() =>
      validateTemplate({ name: 'Aviso', body: 'Debés {saldo_vencido}' }, 'BIRTHDAY'),
    ).toThrow('no puede usar {saldo_vencido}');
    expect(() =>
      validateTemplate({ name: 'Aviso', body: 'Debés {saldo_vencido}' }, 'CHARGE_OVERDUE'),
    ).not.toThrow();
  });

  it('cuenta los días hasta el cumpleaños, cruzando el año y el 29 de febrero', () => {
    expect(daysUntilBirthday('1990-11-10', '2026-11-10')).toBe(0);
    expect(daysUntilBirthday('1990-11-17', '2026-11-10')).toBe(7);
    expect(daysUntilBirthday('1990-11-09', '2026-11-10')).toBe(364);
    expect(daysUntilBirthday('1990-01-02', '2026-12-30')).toBe(3);
    expect(daysUntilBirthday('1992-02-29', '2027-02-27')).toBe(1);
  });

  it('formatea cuotas y fechas', () => {
    expect(chargesLabel(1)).toBe('1 cuota');
    expect(chargesLabel(3)).toBe('3 cuotas');
    expect(shortDate('2026-10-05')).toBe('05/10');
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
    expect(addDays('2026-11-10', -60)).toBe('2026-09-11');
  });
});
