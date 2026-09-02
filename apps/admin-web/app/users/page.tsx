'use client';

import type { AdminRoleDto, AdminUserDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { roleLabel } from '../../lib/permissions';

const initialForm = { username: '', password: '', role: 'RECEPTION' as AdminRoleDto };

export default function UsersPage() {
  const { user: actor } = useAuth();
  const [users, setUsers] = useState<readonly AdminUserDto[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [userToDeactivate, setUserToDeactivate] = useState<AdminUserDto | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const load = useCallback(async () => setUsers(await apiRequest<AdminUserDto[]>('/users')), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm(initialForm);
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo crear el usuario');
    }
  }

  async function updateStatus(user: AdminUserDto, password?: string) {
    if (user.id === actor.id || updating) return;
    setUpdating(true);
    setMessage('');
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
          ...(password ? { currentPassword: password } : {}),
        }),
      });
      setUserToDeactivate(null);
      setCurrentPassword('');
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo actualizar el usuario',
      );
    } finally {
      setUpdating(false);
    }
  }

  function toggle(user: AdminUserDto) {
    if (user.id === actor.id) return;
    if (user.status === 'ACTIVE') {
      setMessage('');
      setCurrentPassword('');
      setUserToDeactivate(user);
      return;
    }
    void updateStatus(user);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Seguridad</p>
          <h1>Usuarios</h1>
          <p className="subtitle">Administrá cuentas y niveles de acceso.</p>
        </div>
      </div>
      <section className="card">
        <h2>Nuevo usuario</h2>
        <form className="catalog-form" onSubmit={create}>
          <label>
            Usuario
            <input
              required
              minLength={3}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </label>
          <label>
            Contraseña
            <input
              required
              minLength={12}
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <label>
            Nivel
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as AdminRoleDto })}
            >
              <option value="RECEPTION">Admisión</option>
              <option value="MANAGER">Administración</option>
              {actor.role === 'ADMINISTRATOR' && <option value="ADMINISTRATOR">Dirección</option>}
            </select>
          </label>
          <button>Crear usuario</button>
        </form>
        {message && !userToDeactivate && <p className="message">{message}</p>}
      </section>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nivel</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Usuario">{user.username}</td>
                  <td data-label="Rol">{roleLabel[user.role]}</td>
                  <td data-label="Estado">
                    <span className={`status ${user.status.toLowerCase()}`}>
                      {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <button
                      className="secondary"
                      disabled={user.id === actor.id}
                      onClick={() => toggle(user)}
                    >
                      {user.id === actor.id
                        ? 'Sesión actual'
                        : user.status === 'ACTIVE'
                          ? 'Desactivar'
                          : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {userToDeactivate && (
        <div className="modal-backdrop">
          <form
            aria-labelledby="deactivate-user-title"
            aria-modal="true"
            className="modal card"
            role="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void updateStatus(userToDeactivate, currentPassword);
            }}
          >
            <h2 id="deactivate-user-title">Desactivar usuario</h2>
            <p className="modal-copy">
              Vas a desactivar a <strong>{userToDeactivate.username}</strong>. No podrá iniciar
              sesión hasta que Dirección reactive su cuenta.
            </p>
            <label>
              Tu contraseña actual de Dirección
              <input
                autoComplete="current-password"
                autoFocus
                required
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            {message && (
              <p className="message" role="alert">
                {message}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={updating}
                type="button"
                onClick={() => {
                  setUserToDeactivate(null);
                  setCurrentPassword('');
                  setMessage('');
                }}
              >
                Cancelar
              </button>
              <button className="danger-button" disabled={updating || !currentPassword}>
                {updating ? 'Desactivando…' : 'Confirmar desactivación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
