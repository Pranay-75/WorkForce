import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { MockStoreProvider } from '@/lib/mockStore';
import { AuthProvider } from '@/lib/authContext';
import { ThemeProvider } from '@/lib/themeContext';

export const metadata: Metadata = {
  metadataBase: new URL('https://workforce-platform.vercel.app'),
  title: {
    default: 'WorkForce - AI-Powered Workforce Management',
    template: '%s | WorkForce',
  },
  description:
    'Explainable workforce capacity monitoring, intelligent skill-based task matching, and workload balancing platform.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://workforce-platform.vercel.app',
    siteName: 'WorkForce',
    title: 'WorkForce - AI-Powered Workforce Management',
    description:
      'Explainable workforce capacity monitoring, intelligent skill-based task matching, and workload balancing platform.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WorkForce - AI-Powered Workforce Management',
    description:
      'Explainable workforce capacity monitoring, intelligent skill-based task matching, and workload balancing platform.',
  },
  alternates: {
    canonical: 'https://workforce-platform.vercel.app',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('wf-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = stored === 'dark' || ((!stored || stored === 'system') && prefersDark);
                  var root = document.documentElement;
                  if (isDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.style.colorScheme = 'dark';
                  } else {
                    root.classList.add('light');
                    root.classList.remove('dark');
                    root.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-wf-canvas text-wf-text-primary antialiased">
        <ThemeProvider>
          <AuthProvider>
            <MockStoreProvider>
              <AppShell>{children}</AppShell>
            </MockStoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
