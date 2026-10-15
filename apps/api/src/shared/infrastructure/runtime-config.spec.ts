import { afterEach, describe, expect, it } from 'vitest';
import { adminOrigins, authCookieConfig } from './runtime-config';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('runtime configuration', () => {
  it('keeps local defaults', () => {
    delete process.env.ADMIN_ORIGINS;
    delete process.env.ADMIN_WEB_URL;
    delete process.env.AUTH_COOKIE_SECURE;
    delete process.env.AUTH_COOKIE_SAME_SITE;
    process.env.NODE_ENV = 'development';

    expect(adminOrigins()).toEqual(['http://localhost:3000']);
    expect(authCookieConfig()).toEqual({ secure: false, sameSite: 'lax' });
  });

  it('parses staging origins and cross-site cookie settings', () => {
    process.env.ADMIN_ORIGINS = 'https://admin.example.com, https://preview.example.com ';
    process.env.AUTH_COOKIE_SECURE = 'true';
    process.env.AUTH_COOKIE_SAME_SITE = 'none';

    expect(adminOrigins()).toEqual(['https://admin.example.com', 'https://preview.example.com']);
    expect(authCookieConfig()).toEqual({ secure: true, sameSite: 'none' });
  });
});
