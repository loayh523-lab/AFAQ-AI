import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AFAQ AI — آفاق',
  description: 'آفاق، مساحة عربية للمحادثة والتعلّم والبرمجة وإنجاز الأفكار.',
  applicationName: 'AFAQ AI',
};
export const viewport: Viewport = { themeColor: '#060a12', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" data-theme="blue"><body>{children}</body></html>;
}
