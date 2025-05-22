import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { NotebookProvider } from '@/contexts/NotebookContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '灵枢笔记',
  description: '连接你的脑海。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className={`${inter.className} h-screen overflow-hidden`}>
        <AuthProvider>
          <SettingsProvider>
            <NotebookProvider>
              {children}
              <Toaster position="bottom-center" />
            </NotebookProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
