import type { DayOfWeek } from '@academy/database';

const dayByShortName: Readonly<Record<string, DayOfWeek>> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};

const partsAt = (date: Date, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

const localMidnightToUtc = (year: number, month: number, day: number, timeZone: string) => {
  const guess = Date.UTC(year, month - 1, day);
  const atGuess = partsAt(new Date(guess), timeZone);
  const represented = Date.UTC(
    Number(atGuess.year),
    Number(atGuess.month) - 1,
    Number(atGuess.day),
    Number(atGuess.hour),
    Number(atGuess.minute),
    Number(atGuess.second),
  );
  return new Date(guess - (represented - guess));
};

export const businessDayAt = (now: Date, timeZone: string) => {
  const parts = partsAt(now, timeZone);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    dateValue: new Date(`${date}T00:00:00.000Z`),
    dayOfWeek: dayByShortName[parts.weekday!]!,
    start: localMidnightToUtc(year, month, day, timeZone),
    end: localMidnightToUtc(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      timeZone,
    ),
  };
};
