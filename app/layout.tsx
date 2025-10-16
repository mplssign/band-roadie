import './globals-simple.css';
import './theme-rose.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Band Roadie',
  description: 'The ultimate band management app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}