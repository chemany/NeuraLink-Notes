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
  icons: {
    icon: '/notepads/favicon.svg',
    shortcut: '/notepads/favicon.svg',
    apple: '/notepads/favicon.svg',
  },
  manifest: '/notepads/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full">
      <head>
        {/* 🚀 性能优化：预加载关键资源 */}
        <link rel="preload" href="/notepads/_next/static/css/app/layout.css" as="style" />
        <link rel="dns-prefetch" href="//www.cheman.top" />
        <link rel="preconnect" href="https://www.cheman.top" crossOrigin="" />
        
        {/* 图标和manifest */}
        <link rel="icon" href="/notepads/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/notepads/favicon.svg" />
      </head>
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
