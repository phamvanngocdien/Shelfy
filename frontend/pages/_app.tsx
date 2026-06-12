import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Layout from '../components/Layout';
import { Toaster } from 'react-hot-toast';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AptosWalletAdapterProvider autoConnect={false}>
        <Layout>
          <Component {...pageProps} />
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: 'toastify',
              success: { className: 'toastify toast-success', duration: 3000 },
              error: { className: 'toastify toast-error', duration: 5000 },
              loading: { className: 'toastify toast-loading' },
            }}
          />
        </Layout>
      </AptosWalletAdapterProvider>
    </QueryClientProvider>
  );
}