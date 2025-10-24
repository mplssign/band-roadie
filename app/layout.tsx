import './globals-simple.css';
import './theme-rose.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers/providers';
import { OrientationGuard } from '@/components/layout/OrientationGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Band Roadie',
  description: 'The ultimate band management app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Band Roadie',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <meta name="theme-color" content="#dc2626" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} min-h-dvh bg-background text-foreground`}>
        <OrientationGuard />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}