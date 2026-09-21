import { defineChain } from 'viem';

export const bohrTestnet = defineChain({
  id: 968,
  name: 'Bohr Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'BOT',
    symbol: 'BOT',
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_BOHR_RPC_URL || 'https://rpc.bohr.life'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Bohr Scan',
      url: import.meta.env.VITE_EXPLORER_URL || 'https://scan.bohr.life/',
    },
  },
  testnet: true,
});

