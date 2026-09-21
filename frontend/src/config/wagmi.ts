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

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'b0ed2f41971704df2800043e6799378c';

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
    url: typeof window !== 'undefined' ? window.location.origin : 'https://earntopay.app',
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

