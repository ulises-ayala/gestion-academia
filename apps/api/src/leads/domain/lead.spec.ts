import { describe, expect, it } from 'vitest';
import { validateLeadInput, assertLeadConvertible } from './lead';

describe('lead domain', () => {
  it('un potencial se convierte en alumno una sola vez', () => {
    expect(() => assertLeadConvertible({ studentId: null })).not.toThrow();
    expect(() => assertLeadConvertible({ studentId: 'student-1' })).toThrow(
      expect.objectContaining({ code: 'LEAD_CONVERSION_CONFLICT' }),
    );
  });

  it('crea una consulta mínima con estado por defecto y contacto opcional', () => {
    expect(validateLeadInput({ name: ' Ana ', source: 'WHATSAPP' })).toMatchObject({
      name: 'Ana',
      source: 'WHATSAPP',
      status: 'INQUIRY',
      phone: null,
      email: null,
      instagram: null,
    });
  });
  it('normaliza contactos sólo para comparación y conserva el valor visible', () => {
    expect(
      validateLeadInput({
        name: 'Ana',
        source: 'INSTAGRAM',
        phone: '+54 (11) 5555-1234',
        email: ' Ana@Example.COM ',
        instagram: '@Ana.Baila',
      }),
    ).toMatchObject({
      phone: '+54 (11) 5555-1234',
      normalizedPhone: '541155551234',
      email: 'Ana@Example.COM',
      normalizedEmail: 'ana@example.com',
      instagram: '@Ana.Baila',
      normalizedInstagram: 'ana.baila',
    });
  });
  it('acepta libremente todos los estados válidos', () => {
    for (const status of ['INQUIRY', 'INTERESTED', 'TRIAL', 'ENROLLED', 'NOT_CONVERTED'] as const)
      expect(validateLeadInput({ name: 'Ana', source: 'IN_PERSON', status }).status).toBe(status);
  });
});
