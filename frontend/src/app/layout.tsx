import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Notebook LM Clone',
  description: 'A clone of Google Notebook LM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className={`${inter.className} h-screen overflow-hidden`}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
