import { afterEach, describe, expect, it } from 'vitest';
import { adminOrigins, authCookieConfig } from './runtime-config';

const originalEnv = { ...process***REMOVED*** };

afterEach(() => {
  process***REMOVED*** = { ...originalEnv };
});

describe('runtime configuration', () => {
  it('keeps local defaults', () => {
    delete process***REMOVED***.ADMIN_ORIGINS;
    delete process***REMOVED***.ADMIN_WEB_URL;
    delete process***REMOVED***.AUTH_COOKIE_SECURE;
    delete process***REMOVED***.AUTH_COOKIE_SAME_SITE;
    process***REMOVED***.NODE_ENV = 'development';

    expect(adminOrigins()).toEqual(['http://localhost:3000']);
    expect(authCookieConfig()).toEqual({ secure: false, sameSite: 'lax' });
  });

  it('parses staging origins and cross-site cookie settings', () => {
    process***REMOVED***.ADMIN_ORIGINS = 'https://admin.example.com, https://preview.example.com ';
    process***REMOVED***.AUTH_COOKIE_SECURE = 'true';
    process***REMOVED***.AUTH_COOKIE_SAME_SITE = 'none';

    expect(adminOrigins()).toEqual(['https://admin.example.com', 'https://preview.example.com']);
    expect(authCookieConfig()).toEqual({ secure: true, sameSite: 'none' });
  });
});
