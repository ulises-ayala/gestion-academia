'use client';

import type { AuthSessionDto, AuthUserDto, SetupStatusDto } from '@academy/contracts';
import { FormEvent, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { roleCan, type UiPermission } from '../lib/permissions';

type AuthContextValue = {
  user: AuthUserDto;
  can(permission: UiPermission): boolean;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return value;
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [ready, setReady] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setUser((await apiRequest<{ user: AuthUserDto }>('/auth/me')).user);
      } catch {
        try {
          setSetupRequired((await apiRequest<SetupStatusDto>('/auth/setup-status')).required);
        } catch {
          /* API no disponible */
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const unauthorized = () => setUser(null);
    window.addEventListener('academy:unauthorized', unauthorized);
    return () => window.removeEventListener('academy:unauthorized', unauthorized);
  }, []);

  async function logout() {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  if (!ready)
    return (
      <main className="auth-shell">
        <p>Comprobando sesión…</p>
      </main>
    );
  if (!user) return <LoginScreen setupRequired={setupRequired} onAuthenticated={setUser} />;
  return (
    <AuthContext.Provider
      value={{ user, can: (permission) => roleCan(user.role, permission), logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen({
  setupRequired,
  onAuthenticated,
}: Readonly<{ setupRequired: boolean; onAuthenticated(user: AuthUserDto): void }>) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      const session = await apiRequest<AuthSessionDto>(
        `/auth/${setupRequired ? 'bootstrap' : 'login'}`,
        { method: 'POST', body: JSON.stringify(credentials) },
      );
      onAuthenticated(session.user);
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo conectar con la API',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <p className="eyebrow">Sistema administrativo</p>
        <h1>{setupRequired ? 'Crear administrador' : 'Iniciar sesión'}</h1>
        <p>
          {setupRequired
            ? 'Configurá el primer usuario administrador del sistema.'
            : 'Ingresá con tu usuario administrativo.'}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              required
              minLength={3}
              value={credentials.username}
              onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete={setupRequired ? 'new-password' : 'current-password'}
              required
              minLength={12}
              value={credentials.password}
              onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
            />
          </label>
          <button disabled={submitting} type="submit">
            {submitting ? 'Procesando…' : setupRequired ? 'Crear administrador' : 'Ingresar'}
          </button>
        </form>
        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
