type RequestHeaders = Readonly<Record<string, string | string[] | undefined>>;

export const readSessionToken = (headers: RequestHeaders): string | undefined => {
  const authorization = headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer '))
    return authorization.slice(7).trim() || undefined;
  const cookie = headers.cookie;
  if (typeof cookie !== 'string') return undefined;
  const item = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('academy_session='));
  return item ? decodeURIComponent(item.slice('academy_session='.length)) : undefined;
};
