const lowercaseParticles = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

function titleCaseWord(word: string) {
  const normalized = word.trim();
  if (!normalized) return '';
  const lower = normalized.toLocaleLowerCase('es-AR');
  if (lowercaseParticles.has(lower)) return lower;
  return `${lower.charAt(0).toLocaleUpperCase('es-AR')}${lower.slice(1)}`;
}

/** Formats a name for reading only; it never changes the value sent to the API. */
export function formatStudentName(lastName: string, firstName: string) {
  const formatPart = (value: string) =>
    value.split(/\s+/).map(titleCaseWord).filter(Boolean).join(' ');
  return `${formatPart(lastName)}, ${formatPart(firstName)}`;
}

/** Formats a recognisable Argentine mobile number for display without changing its source value. */
export function formatStudentPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const match = digits.match(/^(?:54)?9?(\d{4})(\d{2})(\d{4})$/);
  return match ? `+54 9 ${match[1]} ${match[2]}-${match[3]}` : phone;
}
