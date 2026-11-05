import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AFAQ AI — آفاق',
  description: 'A thoughtful multi-model AI workspace for ideas, coding, and creation.',
  applicationName: 'AFAQ AI',
};
export const viewport: Viewport = { themeColor: '#071b17', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
