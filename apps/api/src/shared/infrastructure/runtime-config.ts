const localAdminOrigin = 'http://localhost:3000';

export const adminOrigins = (): string[] => {
  const configured = process***REMOVED***.ADMIN_ORIGINS ?? process***REMOVED***.ADMIN_WEB_URL;
  if (!configured) return [localAdminOrigin];

  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : [localAdminOrigin];
};

export type CookieSameSite = 'lax' | 'strict' | 'none';

export const authCookieConfig = (): { secure: boolean; sameSite: CookieSameSite } => {
  const secure =
    process***REMOVED***.AUTH_COOKIE_SECURE === undefined
      ? process***REMOVED***.NODE_ENV === 'production'
      : process***REMOVED***.AUTH_COOKIE_SECURE === 'true';
  const configuredSameSite = process***REMOVED***.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  const sameSite: CookieSameSite =
    configuredSameSite === 'none' || configuredSameSite === 'strict' ? configuredSameSite : 'lax';

  return { secure, sameSite };
};
