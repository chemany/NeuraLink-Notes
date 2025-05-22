import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { NotebookProvider } from '@/contexts/NotebookContext';
import { AuthProvider } from '@/contexts/AuthContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <NotebookProvider>
          <Component {...pageProps} />
          <Toaster position="bottom-center" />
        </NotebookProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default MyApp; 