import React from 'react';
import ReactDOM from 'react-dom/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig, queryClient } from './config/wagmi';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* wagmiConfig type cast needed due to @reown/appkit-adapter-wagmi dual @wagmi/core versions */}
    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
    <WagmiProvider config={wagmiConfig as any}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
