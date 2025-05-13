import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { NotebookProvider } from '@/contexts/NotebookContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SettingsProvider>
      <NotebookProvider>
        <Component {...pageProps} />
        <Toaster position="bottom-center" />
      </NotebookProvider>
    </SettingsProvider>
  );
}

export default MyApp; 