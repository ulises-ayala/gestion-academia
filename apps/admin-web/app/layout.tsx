import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
import { AuthProvider } from '../components/auth-provider';
import { Toaster } from 'sonner';
import { GlobalLoadingIndicator } from '../components/global-loading-indicator';

export const metadata: Metadata = {
  title: 'Gestión Academia',
  description: 'Panel administrativo de la academia',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <GlobalLoadingIndicator />
        <Toaster 
          theme="dark" 
          position="bottom-right" 
          richColors 
          closeButton 
        />
      </body>
    </html>
  );
}
