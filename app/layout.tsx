import type { Metadata, Viewport } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'AFAQ AI — Think Beyond. Build Beyond.',
  description: 'AFAQ AI is an Arabic-first AI workspace for conversation, learning, research, writing and coding.',
  applicationName: 'AFAQ AI',
  keywords: ['AFAQ AI', 'AI assistant', 'Arabic AI', 'artificial intelligence', 'coding assistant'],
  icons: { icon: '/afaq-mark.svg', shortcut: '/afaq-mark.svg', apple: '/afaq-mark.svg' },
  openGraph: {
    title: 'AFAQ AI — Think Beyond. Build Beyond.',
    description: 'Your intelligent workspace for ideas, learning and building.',
    siteName: 'AFAQ AI',
    type: 'website',
  },
};
export const viewport: Viewport = { themeColor: '#060a12', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" data-theme="blue"><body>{children}</body></html>;
}
