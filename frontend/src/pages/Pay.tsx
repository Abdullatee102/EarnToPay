import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { usePaymentRequests, useCreatePaymentRequest, usePayRequest } from '../hooks/usePayments';
import { useUserBalances } from '../hooks/useEarnToPay';
import { formatBOT, shortAddress, formatTimestamp, isExpired, parseContractError } from '../utils/format';
import { CHAIN_ID, EXPLORER_URL } from '../config/contracts';
import TransactionStatus from '../components/TransactionStatus';
import { parseEther } from 'viem';
import type { PaymentRequest } from '../types';
import type { TxStatus } from '../types';

function PaymentCard({
  req,
  userBalance,
  userAddress,
}: {
  req: PaymentRequest;
  userBalance: bigint;
  userAddress?: `0x${string}`;
}) {
  const { pay, isPending, isConfirming, isSuccess, hash, error, reset } = usePayRequest();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const expired = isExpired(req.deadline);
  const canPay = req.active && !req.paid && !expired && !!userAddress && userBalance >= req.amount;
  const remaining = userBalance >= req.amount ? userBalance - req.amount : 0n;

  const handlePay = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      await pay(req.id);
      setTxStatus('pending');
      setShowConfirm(false);
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  if (isSuccess && txStatus === 'pending') {
    setTxStatus('success');
  }

  const getStatusBadge = () => {
    if (req.paid) return <span className="badge badge--success">Paid</span>;
    if (!req.active) return <span className="badge badge--neutral">Inactive</span>;
    if (expired) return <span className="badge badge--error">Expired</span>;
    return <span className="badge badge--active">Available</span>;
  };

  return (
    <div className={`card payment-card${req.paid || !req.active || expired ? ' payment-card--done' : ''}`}>
      <div className="payment-card-header">
        <div>
          <h3 className="payment-title">{req.title}</h3>
          <div className="payment-amount">{formatBOT(req.amount)} BOT</div>
        </div>
        {getStatusBadge()}
      </div>

      <p className="payment-description">{req.description}</p>

      <div className="payment-meta">
        <div className="meta-row">
          <span className="meta-label">Merchant:</span>
          <span className="meta-value">{shortAddress(req.merchant)}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Created:</span>
          <span className="meta-value">{formatTimestamp(req.createdAt)}</span>
        </div>
        {req.deadline > 0n && (
          <div className="meta-row">
            <span className="meta-label">Deadline:</span>
            <span className={`meta-value${expired ? ' text-error' : ''}`}>
              {formatTimestamp(req.deadline)}
              {expired && ' (Expired)'}
            </span>
          </div>
        )}
        {req.paid && req.paidBy !== '0x0000000000000000000000000000000000000000' && (
          <div className="meta-row">
            <span className="meta-label">Paid by:</span>
            <span className="meta-value">{shortAddress(req.paidBy)}</span>
          </div>
        )}
      </div>

      {/* Payment preview */}
      {canPay && !showConfirm && (
        <div className="payment-preview">
          <div className="preview-row">
            <span>Your balance:</span>
            <span>{formatBOT(userBalance)} BOT</span>
          </div>
          <div className="preview-row">
            <span>Payment:</span>
            <span>-{formatBOT(req.amount)} BOT</span>
          </div>
          <div className="preview-row preview-row--total">
            <span>Remaining:</span>
            <span>{formatBOT(remaining)} BOT</span>
          </div>
        </div>
      )}

      {canPay && !showConfirm && (
        <button className="btn btn--primary" onClick={() => setShowConfirm(true)}>
          Pay {formatBOT(req.amount)} BOT
        </button>
      )}

      {userAddress && !canPay && !req.paid && !expired && req.active && userBalance < req.amount && (
        <div className="alert alert--warning alert--sm">
          Insufficient balance. You have {formatBOT(userBalance)} BOT, need {formatBOT(req.amount)} BOT.
        </div>
      )}

      {showConfirm && (
        <div className="confirm-box">
          <h4>Confirm Payment</h4>
          <p>Pay <strong>{formatBOT(req.amount)} BOT</strong> to <strong>{shortAddress(req.merchant)}</strong></p>
          <p className="confirm-warn">This transaction is irreversible. The merchant will receive BOT immediately.</p>
          <div className="form-actions">
            <button
              className="btn btn--primary"
              onClick={handlePay}
              disabled={isPending || isConfirming}
            >
              {isPending || isConfirming ? 'Processing…' : 'Confirm Payment'}
            </button>
            <button className="btn btn--ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {txStatus !== 'idle' && (
        <TransactionStatus
          status={txStatus}
          hash={hash}
          error={txError}
          explorerUrl={EXPLORER_URL}
          onClose={() => { setTxStatus('idle'); reset?.(); }}
        />
      )}

      {txStatus === 'success' && hash && (
        <div className="receipt">
          <h4>Payment Receipt</h4>
          <div className="receipt-row"><span>Product:</span><span>{req.title}</span></div>
          <div className="receipt-row"><span>Amount:</span><span>{formatBOT(req.amount)} BOT</span></div>
          <div className="receipt-row"><span>Merchant:</span><span>{shortAddress(req.merchant)}</span></div>
          <div className="receipt-row">
            <span>Explorer:</span>
            <a href={`${EXPLORER_URL}tx/${hash}`} target="_blank" rel="noopener noreferrer">View on Bohr Scan ↗</a>
          </div>
        </div>
      )}

      <div className="task-meta">Request #{req.id.toString()}</div>
    </div>
  );
}

function CreateRequestForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountBOT, setAmountBOT] = useState('');
  const [deadline, setDeadline] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const { createRequest, isPending, isConfirming, isSuccess, hash, reset } = useCreatePaymentRequest();

  const handleCreate = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      const amount = parseEther(amountBOT || '0');
      const deadlineTs = deadline ? BigInt(Math.floor(new Date(deadline).getTime() / 1000)) : 0n;
      await createRequest(amount, title.trim(), description.trim(), deadlineTs);
      setTxStatus('pending');
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  if (isSuccess && txStatus === 'pending') {
    setTxStatus('success');
    onCreated();
  }

  return (
    <div className="card create-form">
      <h3>Create Payment Request</h3>
      <p className="form-hint">Create a payment request for products or services. Any connected wallet can create a request.</p>

      <div className="form-field">
        <label className="form-label">Product / Service Title *</label>
        <input className="form-input" placeholder="e.g. Web3 Development Course" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">Description</label>
        <textarea className="form-input" placeholder="Describe the product or service…" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="form-field">
        <label className="form-label">Amount (BOT) *</label>
        <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g. 10" value={amountBOT} onChange={(e) => setAmountBOT(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">Deadline (optional)</label>
        <input className="form-input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>

      <button
        className="btn btn--primary"
        onClick={handleCreate}
        disabled={isPending || isConfirming || !title.trim() || !amountBOT || Number(amountBOT) <= 0}
      >
        {isPending || isConfirming ? 'Creating…' : 'Create Payment Request'}
      </button>

      {txStatus !== 'idle' && (
        <TransactionStatus
          status={txStatus}
          hash={hash}
          error={txError}
          explorerUrl={EXPLORER_URL}
          onClose={() => { setTxStatus('idle'); reset?.(); }}
        />
      )}
    </div>
  );
}

export default function Pay() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === CHAIN_ID;
  const { requests, isLoading, refetch } = usePaymentRequests();
  const { earnedBalance } = useUserBalances(address);
  const [showCreate, setShowCreate] = useState(false);

  const activeRequests = requests.filter((r) => r.active && !r.paid && !isExpired(r.deadline));
  const completedRequests = requests.filter((r) => r.paid);
  const inactiveRequests = requests.filter((r) => !r.active && !r.paid);

  return (
    <div className="page page-pay">
      <div className="page-header">
        <h1 className="page-title">Pay with BOT</h1>
        <p className="page-subtitle">
          Use your earned BOT to pay for products and services.
        </p>
      </div>

      {!isConnected && (
        <div className="alert alert--info">
          <strong>Connect your wallet</strong> to view your balance and pay.
          <div style={{ marginTop: '12px' }}><appkit-button /></div>
        </div>
      )}

      {isConnected && !isCorrectNetwork && (
        <div className="alert alert--warning">
          <strong>Wrong Network</strong> — Switch to Bohr Testnet.
        </div>
      )}

      {isConnected && isCorrectNetwork && (
        <div className="balance-banner">
          <div className="balance-banner-value">{formatBOT(earnedBalance)} BOT</div>
          <div className="balance-banner-label">Available Earned Balance</div>
        </div>
      )}

      {/* Create request */}
      {isConnected && isCorrectNetwork && (
        <div className="section-action">
          <button className="btn btn--outline" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ Create Payment Request (Merchant)'}
          </button>
        </div>
      )}

      {showCreate && isConnected && isCorrectNetwork && (
        <CreateRequestForm onCreated={() => { setShowCreate(false); refetch(); }} />
      )}

      {isLoading ? (
        <div className="loading-state"><div className="spinner" /><p>Loading payment requests…</p></div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💳</div>
          <h3>No Payment Requests</h3>
          <p>No payment requests have been created yet. Merchants can create payment requests above.</p>
        </div>
      ) : (
        <>
          <section className="section">
            <h2 className="section-title">Available Payments ({activeRequests.length})</h2>
            {activeRequests.length === 0 ? (
              <p className="empty-inline">No active payment requests at the moment.</p>
            ) : (
              <div className="payments-grid">
                {activeRequests.map((req) => (
                  <PaymentCard key={req.id.toString()} req={req} userBalance={earnedBalance} userAddress={address} />
                ))}
              </div>
            )}
          </section>

          {completedRequests.length > 0 && (
            <section className="section">
              <h2 className="section-title">Completed Payments ({completedRequests.length})</h2>
              <div className="payments-grid">
                {completedRequests.map((req) => (
                  <PaymentCard key={req.id.toString()} req={req} userBalance={earnedBalance} userAddress={address} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

