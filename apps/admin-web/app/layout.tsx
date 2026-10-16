import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import './styles.css';
import '../components/ui/primitives.css';
import './shell.css';
import './dashboard.css';
import './data-display.css';
import { AuthProvider } from '../components/auth-provider';

const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Gestión Academia',
  description: 'Panel administrativo de la academia',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={geist.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
