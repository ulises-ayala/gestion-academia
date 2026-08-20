'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Student = { id: string; dni: string; firstName: string; lastName: string; birthDate: string | null; phone: string | null; email: string | null; address: string | null; status: 'ACTIVE' | 'INACTIVE' };
type AuthUser = { id: string; username: string; role: 'ADMINISTRATOR' | 'RECEPTION' | 'MANAGER'; status: 'ACTIVE' };
type FormState = { dni: string; firstName: string; lastName: string; birthDate: string; phone: string; email: string; address: string };
const emptyForm: FormState = { dni: '', firstName: '', lastName: '', birthDate: '', phone: '', email: '', address: '' };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [authMessage, setAuthMessage] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/students?status=${status}`, { credentials: 'include' });
      if (response.status === 401) { setUser(null); return; }
      if (!response.ok) throw new Error('No se pudo consultar la lista');
      setStudents(await response.json() as Student[]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Ocurrió un error'); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetch(`${apiUrl}/auth/me`, { credentials: 'include' });
        if (me.ok) setUser(((await me.json()) as { user: AuthUser }).user);
        else {
          const setup = await fetch(`${apiUrl}/auth/setup-status`);
          if (setup.ok) setSetupRequired(((await setup.json()) as { required: boolean }).required);
        }
      } finally { setAuthReady(true); }
    })();
  }, []);

  useEffect(() => { if (user) void loadStudents(); }, [loadStudents, user]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthMessage('');
    const response = await fetch(`${apiUrl}/auth/${setupRequired ? 'bootstrap' : 'login'}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
    });
    const body = await response.json() as { user?: AuthUser; message?: string };
    if (!response.ok || !body.user) { setAuthMessage(body.message ?? 'No se pudo iniciar sesión'); return; }
    setUser(body.user); setSetupRequired(false); setCredentials({ username: '', password: '' });
  }

  async function logout() {
    await fetch(`${apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null); setStudents([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const response = await fetch(`${apiUrl}/students${editingId ? `/${editingId}` : ''}`, {
      method: editingId ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (!response.ok) {
      const error = await response.json() as { message?: string };
      setMessage(error.message ?? 'No se pudo guardar el alumno'); return;
    }
    setForm(emptyForm); setEditingId(null); setMessage(editingId ? 'Alumno actualizado' : 'Alumno creado');
    await loadStudents();
  }

  function edit(student: Student) {
    setEditingId(student.id);
    setForm({ dni: student.dni, firstName: student.firstName, lastName: student.lastName, birthDate: student.birthDate?.slice(0, 10) ?? '', phone: student.phone ?? '', email: student.email ?? '', address: student.address ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deactivate(id: string) {
    if (!window.confirm('¿Desactivar este alumno?')) return;
    const response = await fetch(`${apiUrl}/students/${id}`, { method: 'DELETE', credentials: 'include' });
    setMessage(response.ok ? 'Alumno desactivado' : 'No se pudo desactivar el alumno');
    if (response.ok) await loadStudents();
  }

  if (!authReady) return <main className="auth-shell"><p>Comprobando sesión…</p></main>;
  if (!user) return <main className="auth-shell"><section className="card auth-card">
    <p className="eyebrow">Sistema administrativo</p>
    <h1>{setupRequired ? 'Crear administrador' : 'Iniciar sesión'}</h1>
    <p>{setupRequired ? 'Configurá el primer usuario administrador del sistema.' : 'Ingresá con tu usuario administrativo.'}</p>
    <form className="auth-form" onSubmit={authenticate}>
      <label>Usuario<input autoComplete="username" required minLength={3} value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
      <label>Contraseña<input type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} required minLength={12} value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
      <button type="submit">{setupRequired ? 'Crear administrador' : 'Ingresar'}</button>
    </form>
    {authMessage && <p className="message" role="alert">{authMessage}</p>}
  </section></main>;

  return <main>
    <header className="app-header"><div><p className="eyebrow">Sistema administrativo</p><h1>Alumnos</h1><p className="subtitle">Alta, consulta, modificación y baja lógica de alumnos.</p></div><div className="session"><span>{user.username}</span><button className="secondary" onClick={() => void logout()}>Cerrar sesión</button></div></header>
    <section className="card">
      <h2>{editingId ? 'Editar alumno' : 'Nuevo alumno'}</h2>
      <form onSubmit={submit}>
        <label>DNI<input required value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></label>
        <label>Nombre<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
        <label>Apellido<input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
        <label>Fecha de nacimiento<input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></label>
        <label>Teléfono<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Correo<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="wide">Domicilio<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <div className="actions wide"><button type="submit">{editingId ? 'Guardar cambios' : 'Crear alumno'}</button>{editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}</div>
      </form>
      {message && <p className="message" role="status">{message}</p>}
    </section>
    <section className="card">
      <div className="list-heading"><h2>Listado</h2><select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select></div>
      {loading ? <p>Cargando…</p> : students.length === 0 ? <p>No hay alumnos en este estado.</p> : <div className="table-wrap"><table>
        <thead><tr><th>Alumno</th><th>DNI</th><th>Contacto</th><th>Acciones</th></tr></thead>
        <tbody>{students.map((student) => <tr key={student.id}><td>{student.lastName}, {student.firstName}</td><td>{student.dni}</td><td>{student.email || student.phone || '—'}</td><td className="row-actions"><button className="link" onClick={() => edit(student)}>Editar</button>{student.status === 'ACTIVE' && <button className="link danger" onClick={() => void deactivate(student.id)}>Desactivar</button>}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}
