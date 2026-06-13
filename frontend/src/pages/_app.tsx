// @ts-ignore
import '../styles/globals.css';
// @ts-ignore
import '@rainbow-me/rainbowkit/styles.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '../wagmi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const client = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-[#0a0f0a]">
            <Navbar />
            <main className="pt-16">
              <Component {...pageProps} />
              <Footer />
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}