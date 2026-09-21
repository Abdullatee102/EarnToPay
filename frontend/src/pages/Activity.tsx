import { useAccount, useChainId } from 'wagmi';
import { useActivityEvents } from '../hooks/useActivity';
import { formatBOT, shortAddress, formatTimestamp } from '../utils/format';
import { CHAIN_ID, EXPLORER_URL } from '../config/contracts';

export default function Activity() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === CHAIN_ID;
  const { data: events, isLoading, refetch } = useActivityEvents(address);

  const rewardEvents = events?.filter((e) => e.type === 'reward') ?? [];
  const withdrawalEvents = events?.filter((e) => e.type === 'withdrawal') ?? [];
  const paymentEvents = events?.filter((e) => e.type === 'payment') ?? [];
  const submissionEvents = events?.filter((e) => e.type === 'submission') ?? [];

  if (!isConnected) {
    return (
      <div className="page page-activity">
        <div className="page-header">
          <h1 className="page-title">Activity</h1>
        </div>
        <div className="alert alert--info">
          <strong>Connect your wallet</strong> to see your activity history.
          <div style={{ marginTop: '12px' }}><appkit-button /></div>
        </div>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="page page-activity">
        <div className="page-header">
          <h1 className="page-title">Activity</h1>
        </div>
        <div className="alert alert--warning">
          <strong>Wrong Network</strong> — Switch to Bohr Testnet to view your activity.
        </div>
      </div>
    );
  }

  return (
    <div className="page page-activity">
      <div className="page-header">
        <h1 className="page-title">Activity</h1>
        <p className="page-subtitle">
          Your on-chain earning, withdrawal, and payment history on Bohr Testnet.
        </p>
      </div>

      <div className="wallet-info">
        <span className="wallet-label">Wallet:</span>
        <span className="wallet-address">{shortAddress(address!)}</span>
        <button className="btn btn--ghost btn--sm" onClick={() => refetch()}>Refresh</button>
      </div>

      {isLoading ? (
        <div className="loading-state"><div className="spinner" /><p>Loading activity from chain…</p></div>
      ) : !events || events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Activity Yet</h3>
          <p>Complete tasks to earn BOT, withdraw to your wallet, or use it to pay merchants. Your history will appear here.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="cards-grid cards-grid--4">
            <div className="card">
              <div className="card-label">Rewards Received</div>
              <div className="card-value">{rewardEvents.length}</div>
            </div>
            <div className="card">
              <div className="card-label">Withdrawals</div>
              <div className="card-value">{withdrawalEvents.length}</div>
            </div>
            <div className="card">
              <div className="card-label">Payments Made</div>
              <div className="card-value">{paymentEvents.length}</div>
            </div>
            <div className="card">
              <div className="card-label">Tasks Submitted</div>
              <div className="card-value">{submissionEvents.length}</div>
            </div>
          </div>

          {/* Full timeline */}
          <section className="section">
            <h2 className="section-title">All Activity</h2>
            <div className="activity-list activity-list--full">
              {events.map((event, i) => (
                <div key={`${event.txHash}-${i}`} className={`activity-item activity-item--${event.type}`}>
                  <div className="activity-icon-lg">
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
                      {event.type === 'reward' && (
                        <span className="amount-positive">+{formatBOT(event.amount ?? 0n)} BOT</span>
                      )}
                      {event.type === 'withdrawal' && (
                        <span className="amount-neutral">-{formatBOT(event.amount ?? 0n)} BOT (Withdrawn to Wallet)</span>
                      )}
                      {event.type === 'payment' && (
                        <span className="amount-negative">-{formatBOT(event.amount ?? 0n)} BOT</span>
                      )}
                      {event.type === 'submission' && (
                        <span>Task Submitted</span>
                      )}
                    </div>
                    <div className="activity-sub">
                      {event.type === 'reward' && `Reward for Task #${event.taskId?.toString()}`}
                      {event.type === 'withdrawal' && `Withdrawn to ${event.counterparty ? shortAddress(event.counterparty) : shortAddress(address!)}`}
                      {event.type === 'payment' && `Paid to ${event.counterparty ? shortAddress(event.counterparty) : '—'} · Request #${event.requestId?.toString()}`}
                      {event.type === 'submission' && `Task #${event.taskId?.toString()} completion submitted`}
                    </div>
                    <div className="activity-meta">
                      <span className="activity-time">{formatTimestamp(event.timestamp ?? 0n)}</span>
                      <a
                        href={`${EXPLORER_URL}tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="activity-tx"
                      >
                        {event.txHash.slice(0, 8)}…{event.txHash.slice(-6)} ↗
                      </a>
                    </div>
                  </div>
                  <div className={`activity-type-badge activity-type-badge--${event.type}`}>
                    {event.type === 'reward'
                      ? 'Reward'
                      : event.type === 'withdrawal'
                      ? 'Withdrawal'
                      : event.type === 'payment'
                      ? 'Payment'
                      : 'Submission'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
