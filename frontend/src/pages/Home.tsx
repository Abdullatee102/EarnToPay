import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';
import { useUserBalances, usePlatformStats, useWithdrawEarned } from '../hooks/useEarnToPay';
import { useAllRecentEvents } from '../hooks/useActivity';
import { formatBOT, shortAddress, relativeTime, parseContractError } from '../utils/format';
import { EXPLORER_URL, CHAIN_ID } from '../config/contracts';
import TransactionStatus from '../components/TransactionStatus';
import { parseEther, formatEther } from 'viem';
import type { TxStatus } from '../types';

function WithdrawModal({
  availableBalance,
  userAddress,
  onClose,
  onSuccess,
}: {
  availableBalance: bigint;
  userAddress: `0x${string}`;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amountInput, setAmountInput] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const { withdraw, isPending, isConfirming, isSuccess, hash, reset } = useWithdrawEarned();

  const numAvailable = Number(formatEther(availableBalance));
  const numInput = Number(amountInput || '0');
  const parsedAmount = amountInput ? parseEther(amountInput) : 0n;

  const isValidAmount = numInput > 0 && parsedAmount <= availableBalance;
  const remainingBalance = availableBalance >= parsedAmount ? availableBalance - parsedAmount : 0n;

  const handleWithdraw = async () => {
    if (!isValidAmount) return;
    setTxStatus('confirming');
    setTxError('');
    try {
      await withdraw(parsedAmount);
      setTxStatus('pending');
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  useEffect(() => {
    if (isSuccess && txStatus === 'pending') {
      setTxStatus('success');
      onSuccess();
    }
  }, [isSuccess]);

  const setPercentage = (pct: number) => {
    const val = (numAvailable * pct) / 100;
    // Format up to 4 decimal places
    setAmountInput(val.toFixed(4).replace(/\.?0+$/, ''));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Withdraw Earned BOT</h3>
            <p className="modal-sub">Transfer approved rewards from EarnToPay to your wallet</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Destination Notice */}
          <div className="withdraw-dest-box">
            <div className="dest-label">Withdrawal Destination (Connected Wallet)</div>
            <div className="dest-address-wrap">
              <span className="dest-icon">👛</span>
              <code>{userAddress}</code>
            </div>
            <span className="dest-hint">Funds will be sent directly to your connected wallet on Bohr Testnet.</span>
          </div>

          {/* Amount input */}
          <div className="form-field">
            <div className="form-label-row">
              <label className="form-label">Withdrawal Amount (BOT) *</label>
              <span className="available-hint">
                Available: <strong>{formatBOT(availableBalance)} BOT</strong>
              </span>
            </div>

            <div className="amount-input-wrap">
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.0001"
                max={numAvailable.toString()}
                placeholder="0.0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn btn--outline btn--sm btn-max"
                onClick={() => setPercentage(100)}
              >
                MAX
              </button>
            </div>

            {/* Quick percentage buttons */}
            <div className="quick-pct-buttons">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPercentage(25)}>25%</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPercentage(50)}>50%</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPercentage(75)}>75%</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPercentage(100)}>100%</button>
            </div>
          </div>

          {/* Balance Preview */}
          {isValidAmount && (
            <div className="withdraw-preview-card">
              <div className="preview-row">
                <span>Current Earned Balance:</span>
                <span>{formatBOT(availableBalance)} BOT</span>
              </div>
              <div className="preview-row">
                <span>Withdrawing:</span>
                <span className="amount-negative">-{formatBOT(parsedAmount)} BOT</span>
              </div>
              <div className="preview-row preview-row--total">
                <span>Remaining Earned Balance:</span>
                <span>{formatBOT(remainingBalance)} BOT</span>
              </div>
              <div className="preview-row preview-row--wallet">
                <span>Real BOT Arriving in Wallet:</span>
                <span className="amount-positive">+{formatBOT(parsedAmount)} BOT</span>
              </div>
            </div>
          )}

          {amountInput && !isValidAmount && (
            <div className="alert alert--error alert--sm">
              {parsedAmount > availableBalance
                ? `Amount exceeds your available balance of ${formatBOT(availableBalance)} BOT.`
                : 'Please enter a valid withdrawal amount greater than 0.'}
            </div>
          )}

          {/* Action buttons */}
          <div className="form-actions" style={{ marginTop: '12px' }}>
            <button
              className="btn btn--primary"
              onClick={handleWithdraw}
              disabled={isPending || isConfirming || !isValidAmount}
            >
              {isPending || isConfirming ? 'Confirming Withdrawal in Wallet…' : `Confirm Withdrawal of ${amountInput || '0'} BOT`}
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
          </div>

          {txStatus !== 'idle' && (
            <TransactionStatus
              status={txStatus}
              hash={hash}
              error={txError}
              explorerUrl={EXPLORER_URL}
              onClose={() => {
                setTxStatus('idle');
                reset?.();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === CHAIN_ID;
  const { earnedBalance, totalEarned, totalSpent, totalWithdrawn, refetch } = useUserBalances(address);
  const stats = usePlatformStats();
  const { data: recentEvents, refetch: refetchActivity } = useAllRecentEvents();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  return (
    <div className="page page-home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Bohr Testnet · Chain ID 968</div>
          <h1 className="hero-title">
            <span className="gradient-text">EarnToPay</span>
          </h1>
          <p className="hero-subtitle">
            Complete verified tasks → Earn BOT rewards → Pay merchants or Withdraw to wallet.<br />
            Turn your verified activity into digital value.
          </p>

          {!isConnected ? (
            <div className="hero-connect">
              <appkit-button />
              <p className="hero-connect-hint">Connect your wallet to get started</p>
            </div>
          ) : !isCorrectNetwork ? (
            <div className="alert alert--warning">
              <strong>Wrong Network</strong> — Please switch to Bohr Testnet (Chain ID 968)
              <div style={{ marginTop: '10px' }}><appkit-network-button /></div>
            </div>
          ) : null}
        </div>

        {/* Flow diagram */}
        <div className="flow-diagram">
          <div className="flow-step">
            <div className="flow-icon">📋</div>
            <div className="flow-label">Complete Tasks</div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">⚡</div>
            <div className="flow-label">Earn BOT</div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">💳</div>
            <div className="flow-label">Pay Merchants</div>
          </div>
          <div className="flow-arrow">or</div>
          <div className="flow-step">
            <div className="flow-icon">🏦</div>
            <div className="flow-label">Withdraw to Wallet</div>
          </div>
        </div>
      </section>

      {/* User Balances & Withdrawal */}
      {isConnected && isCorrectNetwork && (
        <section className="section">
          <div className="section-header-flex">
            <h2 className="section-title">Your EarnToPay Balances</h2>
            {earnedBalance > 0n && (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => setShowWithdrawModal(true)}
              >
                🏦 Withdraw BOT
              </button>
            )}
          </div>

          <div className="cards-grid cards-grid--4">
            <div className="card card--highlight">
              <div className="card-label">Available to Spend / Withdraw</div>
              <div className="card-value">{formatBOT(earnedBalance)} <span className="unit">BOT</span></div>
              <div className="card-sub">
                {earnedBalance > 0n ? (
                  <button
                    className="btn-link-action"
                    onClick={() => setShowWithdrawModal(true)}
                  >
                    Withdraw to Wallet →
                  </button>
                ) : (
                  'Complete tasks to earn'
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-label">Total Earned</div>
              <div className="card-value">{formatBOT(totalEarned)} <span className="unit">BOT</span></div>
              <div className="card-sub">Lifetime approved rewards</div>
            </div>

            <div className="card">
              <div className="card-label">Total Withdrawn</div>
              <div className="card-value">{formatBOT(totalWithdrawn)} <span className="unit">BOT</span></div>
              <div className="card-sub">Transferred to wallet</div>
            </div>

            <div className="card">
              <div className="card-label">Total Spent</div>
              <div className="card-value">{formatBOT(totalSpent)} <span className="unit">BOT</span></div>
              <div className="card-sub">Merchant payments</div>
            </div>
          </div>

          <div className="wallet-info">
            <span className="wallet-label">Connected Wallet:</span>
            <span className="wallet-address">{shortAddress(address!)}</span>
          </div>
        </section>
      )}

      {/* CTA buttons */}
      {isConnected && isCorrectNetwork && (
        <section className="section section--cta">
          <div className="cta-grid cta-grid--3">
            <Link to="/earn" className="cta-card cta-card--earn">
              <div className="cta-icon">🎯</div>
              <h3>Earn BOT</h3>
              <p>Browse active tasks and submit completion proofs to earn BOT rewards.</p>
              <span className="cta-btn">View Tasks →</span>
            </Link>

            <Link to="/pay" className="cta-card cta-card--pay">
              <div className="cta-icon">💳</div>
              <h3>Pay with BOT</h3>
              <p>Use your earned balance to pay merchants for products and services.</p>
              <span className="cta-btn">Browse Payments →</span>
            </Link>

            <div
              className="cta-card cta-card--withdraw"
              onClick={() => {
                if (earnedBalance > 0n) {
                  setShowWithdrawModal(true);
                }
              }}
              style={{ cursor: earnedBalance > 0n ? 'pointer' : 'default' }}
            >
              <div className="cta-icon">🏦</div>
              <h3>Withdraw BOT</h3>
              <p>Transfer your earned rewards directly into your connected wallet.</p>
              <span className="cta-btn">
                {earnedBalance > 0n ? `Withdraw ${formatBOT(earnedBalance)} BOT →` : 'No Balance to Withdraw'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Platform Stats */}
      {stats && (
        <section className="section">
          <h2 className="section-title">Platform Statistics</h2>
          <div className="cards-grid cards-grid--3">
            <div className="card">
              <div className="card-label">Active Tasks</div>
              <div className="card-value">{stats.taskCount.toString()}</div>
            </div>
            <div className="card">
              <div className="card-label">Reward Pool</div>
              <div className="card-value">{formatBOT(stats.rewardPool)} <span className="unit">BOT</span></div>
            </div>
            <div className="card">
              <div className="card-label">Total Rewards Issued</div>
              <div className="card-value">{formatBOT(stats.totalRewardsIssued)} <span className="unit">BOT</span></div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Activity */}
      {recentEvents && recentEvents.length > 0 && (
        <section className="section">
          <h2 className="section-title">Recent Platform Activity</h2>
          <div className="activity-list">
            {recentEvents.slice(0, 8).map((event, i) => (
              <div key={`${event.txHash}-${i}`} className={`activity-item activity-item--${event.type}`}>
                <div className="activity-icon">
                  {event.type === 'reward'
                    ? '✅'
                    : event.type === 'withdrawal'
                    ? '🏦'
                    : event.type === 'payment'
                    ? '💳'
                    : '📝'}
                </div>
                <div className="activity-content">
                  <div className="activity-title">
                    {event.type === 'reward' && `+${formatBOT(event.amount ?? 0n)} BOT earned (Task #${event.taskId?.toString()})`}
                    {event.type === 'withdrawal' && `-${formatBOT(event.amount ?? 0n)} BOT withdrawn to wallet`}
                    {event.type === 'payment' && `-${formatBOT(event.amount ?? 0n)} BOT paid`}
                    {event.type === 'submission' && `Task #${event.taskId?.toString()} submitted`}
                  </div>
                  {event.counterparty && (
                    <div className="activity-sub">{shortAddress(event.counterparty)}</div>
                  )}
                  <div className="activity-time">{relativeTime(event.timestamp ?? 0n)}</div>
                </div>
                <a
                  href={`${EXPLORER_URL}tx/${event.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="activity-link"
                  title="View on Bohr Scan"
                >
                  ↗
                </a>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px' }}>
            <Link to="/activity" className="btn btn--ghost">View All Activity →</Link>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="section section--how">
        <h2 className="section-title">How EarnToPay Works</h2>
        <div className="steps-grid">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Admin Creates Tasks</h3>
            <p>The platform administrator defines legitimate earning tasks with BOT rewards.</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>You Complete Tasks</h3>
            <p>Browse active tasks, complete the requirements, and submit proof of completion.</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Admin Verifies</h3>
            <p>The admin reviews and approves valid completions, then issues the BOT reward.</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Earn BOT</h3>
            <p>Your EarnToPay earned balance increases — fully on-chain and verifiable.</p>
          </div>
          <div className="step">
            <div className="step-number">5</div>
            <h3>Pay or Withdraw</h3>
            <p>Pay merchants for products & services, or withdraw BOT directly to your wallet.</p>
          </div>
          <div className="step">
            <div className="step-number">6</div>
            <h3>Instant Settlement</h3>
            <p>Payments and withdrawals execute natively on Bohr Testnet with instant receipts.</p>
          </div>
        </div>
      </section>

      {/* Withdraw Modal */}
      {showWithdrawModal && address && (
        <WithdrawModal
          availableBalance={earnedBalance}
          userAddress={address}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            refetch();
            refetchActivity();
          }}
        />
      )}
    </div>
  );
}
