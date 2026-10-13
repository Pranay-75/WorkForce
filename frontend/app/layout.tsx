import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { MockStoreProvider } from '@/lib/mockStore';
import { AuthProvider } from '@/lib/authContext';

export const metadata: Metadata = {
  title: 'WorkForce - AI-Powered Workforce Management',
  description:
    'Explainable workforce capacity monitoring, intelligent skill-based task matching, and workload balancing platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background-base text-slate-100 antialiased">
        <AuthProvider>
          <MockStoreProvider>
            <AppShell>{children}</AppShell>
          </MockStoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
