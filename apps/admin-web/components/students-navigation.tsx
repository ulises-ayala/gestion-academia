import Link from 'next/link';

type StudentsSection = 'all' | 'follow-up';

export function StudentsNavigation({ active }: Readonly<{ active: StudentsSection }>) {
  return (
    <div className="students-navigation">
      <Link
        aria-current={active === 'all' ? 'page' : undefined}
        className="ui-tab"
        href="/students"
        title="Listado, altas y fichas de alumnos."
      >
        Todos los alumnos
        <span className="sr-only">: listado, altas y fichas de alumnos.</span>
      </Link>
      <Link
        aria-current={active === 'follow-up' ? 'page' : undefined}
        className="ui-tab"
        href="/students/follow-up"
        title="Alumnos con ausencias consecutivas."
      >
        Requieren seguimiento
        <span className="sr-only">: alumnos con ausencias consecutivas.</span>
      </Link>
    </div>
  );
}
