import { EARN_TO_PAY_ABI } from '../abi/EarnToPay';

export const CONTRACT_ADDRESS = (import.meta.env.VITE_EARN_TO_PAY_CONTRACT_ADDRESS || '0xadceA08A5188538904E6666C59021Bd4e9548CEB') as `0x${string}`;
export const CONTRACT_ABI = EARN_TO_PAY_ABI;
export const CHAIN_ID = Number(import.meta.env.VITE_BOHR_CHAIN_ID || 968);
export const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || 'https://scan.bohr.life/';
export const RPC_URL = import.meta.env.VITE_BOHR_RPC_URL || 'https://rpc.bohr.life';

export const explorerTx = (hash: string) => `${EXPLORER_URL}tx/${hash}`;
export const explorerAddress = (addr: string) => `${EXPLORER_URL}address/${addr}`;

