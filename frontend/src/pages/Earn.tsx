import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTasks, useCompletion } from '../hooks/useTasks';
import { useSubmitCompletion } from '../hooks/useEarnToPay';
import { formatBOT, completionStatus, parseContractError } from '../utils/format';
import { CHAIN_ID, EXPLORER_URL } from '../config/contracts';
import TransactionStatus from '../components/TransactionStatus';
import type { Task } from '../types';
import type { TxStatus } from '../types';

function TaskCard({ task, userAddress }: { task: Task; userAddress?: `0x${string}` }) {
  const { completion, refetch } = useCompletion(userAddress, task.id);
  const { submit, isPending, isConfirming, isSuccess, hash, error, reset } = useSubmitCompletion();
  const [proofNote, setProofNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');

  const statusLabel = completionStatus(completion ?? null);
  const hasSubmitted = completion?.submitted ?? false;
  const isRewarded = completion?.rewarded ?? false;
  const isApproved = completion?.approved ?? false;

  const handleSubmit = async () => {
    if (!proofNote.trim()) return;
    setTxStatus('confirming');
    setTxError('');
    try {
      await submit(task.id, proofNote.trim());
      setTxStatus('pending');
      setShowForm(false);
      refetch();
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  // Track confirmation
  if (isSuccess && txStatus === 'pending') {
    setTxStatus('success');
    refetch();
  }

  const getBadgeClass = () => {
    if (isRewarded) return 'badge badge--success';
    if (isApproved) return 'badge badge--info';
    if (hasSubmitted) return 'badge badge--warning';
    return 'badge badge--neutral';
  };

  return (
    <div className={`card task-card${!task.active ? ' task-card--inactive' : ''}`}>
      <div className="task-card-header">
        <div>
          <h3 className="task-title">{task.title}</h3>
          <div className="task-reward">
            <span className="reward-amount">+{formatBOT(task.reward)} BOT</span>
          </div>
        </div>
        <div className="task-badges">
          {!task.active && <span className="badge badge--error">Inactive</span>}
          {task.active && <span className="badge badge--active">Active</span>}
          {userAddress && <span className={getBadgeClass()}>{statusLabel}</span>}
        </div>
      </div>

      <p className="task-description">{task.description}</p>

      <div className="task-requirement">
        <span className="req-label">Requirement:</span>
        <span>{task.requirement}</span>
      </div>

      {userAddress && task.active && !hasSubmitted && (
        <div className="task-actions">
          {!showForm ? (
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>
              Submit Completion
            </button>
          ) : (
            <div className="proof-form">
              <label className="form-label">Proof / Note (required)</label>
              <textarea
                className="form-input"
                placeholder="Describe how you completed this task or provide a reference/link…"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                rows={3}
              />
              <div className="form-actions">
                <button
                  className="btn btn--primary"
                  onClick={handleSubmit}
                  disabled={isPending || isConfirming || !proofNote.trim()}
                >
                  {isPending || isConfirming ? 'Submitting…' : 'Submit'}
                </button>
                <button className="btn btn--ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
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

      {hasSubmitted && (
        <div className="completion-info">
          <div className="completion-status">
            Status: <strong>{statusLabel}</strong>
          </div>
          {completion?.proofNote && (
            <div className="completion-proof">Proof: {completion.proofNote}</div>
          )}
        </div>
      )}

      <div className="task-meta">
        <span>Task #{task.id.toString()}</span>
      </div>
    </div>
  );
}

export default function Earn() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === CHAIN_ID;
  const { tasks, isLoading } = useTasks();

  const activeTasks = tasks.filter((t) => t.active);
  const inactiveTasks = tasks.filter((t) => !t.active);

  return (
    <div className="page page-earn">
      <div className="page-header">
        <h1 className="page-title">Earn BOT</h1>
        <p className="page-subtitle">
          Complete platform-defined tasks and earn BOT rewards after admin verification.
        </p>
      </div>

      {!isConnected && (
        <div className="alert alert--info">
          <strong>Connect your wallet</strong> to see your completion status and submit tasks.
          <div style={{ marginTop: '12px' }}>
            <appkit-button />
          </div>
        </div>
      )}

      {isConnected && !isCorrectNetwork && (
        <div className="alert alert--warning">
          <strong>Wrong Network</strong> — Switch to Bohr Testnet to interact with tasks.
        </div>
      )}

      {/* How rewards work */}
      <div className="info-box">
        <h3>How Earning Works</h3>
        <div className="info-steps">
          <span>📋 Complete task</span>
          <span>→</span>
          <span>📤 Submit proof</span>
          <span>→</span>
          <span>🔍 Admin verifies</span>
          <span>→</span>
          <span>✅ Receive BOT</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading tasks…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Tasks Available</h3>
          <p>The platform admin hasn't created any tasks yet. Check back soon!</p>
        </div>
      ) : (
        <>
          <section className="section">
            <h2 className="section-title">Active Tasks ({activeTasks.length})</h2>
            {activeTasks.length === 0 ? (
              <p className="empty-inline">No active tasks at the moment.</p>
            ) : (
              <div className="tasks-grid">
                {activeTasks.map((task) => (
                  <TaskCard key={task.id.toString()} task={task} userAddress={address} />
                ))}
              </div>
            )}
          </section>

          {inactiveTasks.length > 0 && (
            <section className="section">
              <h2 className="section-title">Inactive Tasks ({inactiveTasks.length})</h2>
              <div className="tasks-grid">
                {inactiveTasks.map((task) => (
                  <TaskCard key={task.id.toString()} task={task} userAddress={address} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
