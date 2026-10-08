import Link from 'next/link';

type StudentsSection = 'all' | 'follow-up';

export function StudentsNavigation({ active }: Readonly<{ active: StudentsSection }>) {
  return (
    <nav aria-label="Secciones de alumnos" className="students-navigation">
      <Link
        aria-current={active === 'all' ? 'page' : undefined}
        className={`students-navigation-link ${active === 'all' ? 'active' : ''}`}
        href="/students"
      >
        <strong>Todos los alumnos</strong>
        <span>Listado, altas y fichas de alumnos.</span>
      </Link>
      <Link
        aria-current={active === 'follow-up' ? 'page' : undefined}
        className={`students-navigation-link ${active === 'follow-up' ? 'active' : ''}`}
        href="/students/follow-up"
      >
        <strong>Requieren seguimiento</strong>
        <span>Alumnos con ausencias consecutivas.</span>
      </Link>
    </nav>
  );
}
