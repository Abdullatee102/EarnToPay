/// <reference types="vite/client" />

// Reown AppKit web components
declare namespace JSX {
  interface IntrinsicElements {
    'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      label?: string;
      loadingLabel?: string;
    };
    'appkit-network-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'appkit-account-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}

interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID: string;
  readonly VITE_BOHR_CHAIN_ID: string;
  readonly VITE_BOHR_RPC_URL: string;
  readonly VITE_EXPLORER_URL: string;
  readonly VITE_EARN_TO_PAY_CONTRACT_ADDRESS: string;
  readonly VITE_ADMIN_PASSWORD_HASH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

