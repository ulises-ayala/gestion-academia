import { redirect } from 'next/navigation';

/** El tablero pasó a ser la pestaña "Este mes" de Inicio; esta ruta queda para los enlaces viejos. */
export default function BoardPage() {
  redirect('/?vista=mes');
}
