'use client';

import type { AuthSessionDto, AuthUserDto, SetupStatusDto } from '@academy/contracts';
import {
  default as React,
  FormEvent,
  createContext,
  useContext,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { roleCan, type UiPermission } from '../lib/permissions';

type AuthContextValue = {
  user: AuthUserDto;
  can(permission: UiPermission): boolean;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
type Credentials = Readonly<{ username: string; password: string }>;

export function authenticate(credentials: Credentials, setupRequired: boolean) {
  return apiRequest<AuthSessionDto>(`/auth/${setupRequired ? 'bootstrap' : 'login'}`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function PasswordField({
  password,
  visible,
  setupRequired,
  onChange,
  onToggle,
}: Readonly<{
  password: string;
  visible: boolean;
  setupRequired: boolean;
  onChange(event: ChangeEvent<HTMLInputElement>): void;
  onToggle(): void;
}>) {
  return (
    <span className="password-field">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={setupRequired ? 'new-password' : 'current-password'}
        required
        minLength={12}
        value={password}
        onChange={onChange}
      />
      <button
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="password-toggle"
        onClick={onToggle}
        type="button"
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </span>
  );
}

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

export function LoginScreen({
  setupRequired,
  onAuthenticated,
}: Readonly<{ setupRequired: boolean; onAuthenticated(user: AuthUserDto): void }>) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      const session = await authenticate(credentials, setupRequired);
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
            <PasswordField
              password={credentials.password}
              visible={showPassword}
              setupRequired={setupRequired}
              onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
              onToggle={() => setShowPassword((visible) => !visible)}
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
