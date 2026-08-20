export function calculateAge(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(new Date(value));
}
