import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Serif } from 'next/font/google';
import './globals.css';

const ibmSans = IBM_Plex_Sans({
  variable: '--font-ibm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const ibmMono = IBM_Plex_Mono({
  variable: '--font-ibm-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const ibmSerif = IBM_Plex_Serif({
  variable: '--font-ibm-serif',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Fauna',
  description: 'A community accessibility analyser for the University of Liverpool.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmSans.variable} ${ibmMono.variable} ${ibmSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
