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

  async function toggle(user: AdminUserDto) {
    if (user.id === actor.id) return;
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo actualizar el usuario',
      );
    }
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
        {message && <p className="message">{message}</p>}
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
                  <td>{user.username}</td>
                  <td>{roleLabel[user.role]}</td>
                  <td>
                    <span className={`status ${user.status.toLowerCase()}`}>
                      {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="secondary"
                      disabled={user.id === actor.id}
                      onClick={() => void toggle(user)}
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
    </>
  );
}
