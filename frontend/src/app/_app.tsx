import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { NotebookProvider } from '@/contexts/NotebookContext';
import { SettingsProvider } from '@/contexts/SettingsContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SettingsProvider>
      <NotebookProvider>
        <Component {...pageProps} />
      </NotebookProvider>
    </SettingsProvider>
  );
} 