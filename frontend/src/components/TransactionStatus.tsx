import type { TxStatus } from '../types';

interface Props {
  status: TxStatus;
  hash?: `0x${string}`;
  error?: string;
  onClose?: () => void;
  explorerUrl?: string;
}

export default function TransactionStatus({ status, hash, error, onClose, explorerUrl }: Props) {
  if (status === 'idle') return null;

  const getContent = () => {
    switch (status) {
      case 'confirming':
        return {
          icon: '🔐',
          title: 'Confirm in Wallet',
          message: 'Please approve the transaction in your wallet.',
          color: 'warning',
        };
      case 'pending':
        return {
          icon: '⏳',
          title: 'Transaction Pending',
          message: 'Waiting for blockchain confirmation…',
          color: 'info',
        };
      case 'success':
        return {
          icon: '✅',
          title: 'Transaction Confirmed',
          message: 'Your transaction was successful!',
          color: 'success',
        };
      case 'error':
        return {
          icon: '❌',
          title: 'Transaction Failed',
          message: error || 'The transaction failed. Please try again.',
          color: 'error',
        };
    }
  };

  const content = getContent();

  return (
    <div className={`tx-status tx-status--${content.color}`}>
      <div className="tx-status-header">
        <span className="tx-status-icon">{content.icon}</span>
        <span className="tx-status-title">{content.title}</span>
        {onClose && status !== 'confirming' && status !== 'pending' && (
          <button className="tx-status-close" onClick={onClose}>×</button>
        )}
      </div>
      <p className="tx-status-message">{content.message}</p>
      {hash && (
        <div className="tx-status-hash">
          <span>Tx: </span>
          {explorerUrl ? (
            <a href={`${explorerUrl}tx/${hash}`} target="_blank" rel="noopener noreferrer">
              {hash.slice(0, 10)}…{hash.slice(-6)}
            </a>
          ) : (
            <code>{hash.slice(0, 10)}…{hash.slice(-6)}</code>
          )}
        </div>
      )}
    </div>
  );
}

