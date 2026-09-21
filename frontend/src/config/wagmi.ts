import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { QueryClient } from '@tanstack/react-query';
import { bohrTestnet } from './chains';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  },
});

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '';

if (!projectId && typeof window !== 'undefined') {
  console.warn('VITE_REOWN_PROJECT_ID is not configured in environment variables.');
}

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [bohrTestnet],
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [bohrTestnet],
  defaultNetwork: bohrTestnet,
  projectId,
  metadata: {
    name: 'EarnToPay',
    description: 'Complete Tasks → Earn BOT → Pay Merchants on Bohr Testnet',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://earn-to-pay.vercel.app',
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#6366f1',
    '--w3m-border-radius-master': '12px',
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

