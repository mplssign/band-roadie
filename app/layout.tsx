import './globals-simple.css';
import './theme-rose.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers/providers';
import { OrientationGuard } from '@/components/layout/OrientationGuard';
import ServiceWorkerUpdater from './(providers)/ServiceWorkerUpdater';

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
        
        {/* Performance optimizations */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        {/* Critical resource hints */}
        <link rel="modulepreload" href="/_next/static/chunks/webpack.js" />
        <link rel="modulepreload" href="/_next/static/chunks/main.js" />
        
        {/* Preload critical CSS */}
        <style id="critical-css">{`
          .min-h-dvh{min-height:100dvh}
          .bg-background{background-color:hsl(var(--background))}
          .text-foreground{color:hsl(var(--foreground))}
          .h-full{height:100%}
          .dark{color-scheme:dark}
        `}</style>
      </head>
      <body className={`${inter.className} min-h-dvh bg-background text-foreground`}>
        <ServiceWorkerUpdater />
        <OrientationGuard />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}