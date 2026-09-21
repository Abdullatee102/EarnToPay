import { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useAdmin, usePlatformStats, useFundRewardPool } from '../hooks/useEarnToPay';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useSetTaskActive,
  useApproveCompletion,
  useIssueReward,
  useApproveAndIssueReward,
  useSubmittedCompletions,
} from '../hooks/useTasks';
import { useAllRecentEvents } from '../hooks/useActivity';
import {
  formatBOT,
  shortAddress,
  formatTimestamp,
  relativeTime,
  parseContractError,
  verifyAdminPassword,
  updateAdminPassword,
  resetAdminPassword,
  isCustomPasswordSet,
  getActiveAdminHash,
} from '../utils/format';
import { CHAIN_ID, EXPLORER_URL } from '../config/contracts';
import TransactionStatus from '../components/TransactionStatus';
import { parseEther, formatEther } from 'viem';
import type { Task, SubmittedCompletion, TxStatus } from '../types';

// ============================================================
// 1. Admin Login & Reset Gate
// ============================================================
function AdminLogin({ onAuth }: { onAuth: () => void }) {
  const { address, isConnected } = useAccount();
  const { adminAddress, isAdmin } = useAdmin();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError('');
    const isValid = await verifyAdminPassword(password);
    if (isValid) {
      sessionStorage.setItem('etp_admin_auth', '1');
      onAuth();
    } else {
      setError('Incorrect admin password. Please try again.');
    }
    setChecking(false);
  };

  const handleWalletReset = async (toDefault = false) => {
    setResetError('');
    setResetSuccess('');

    if (!isAdmin) {
      setResetError(
        `Unauthorized: Only the contract admin wallet (${shortAddress(adminAddress ?? '0x')}) can reset the password.`
      );
      return;
    }

    if (toDefault) {
      resetAdminPassword();
      setResetSuccess('Admin password has been reset to default: earntopay-admin-2024');
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess('');
      }, 2000);
      return;
    }

    if (!newResetPassword || newResetPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    await updateAdminPassword(newResetPassword);
    setResetSuccess('Admin password updated successfully! You can now log in.');
    setTimeout(() => {
      setShowResetModal(false);
      setResetSuccess('');
      setNewResetPassword('');
      setConfirmResetPassword('');
    }, 1800);
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-icon">🔐</div>
        <h2>Admin Authentication</h2>
        <p>Enter the dashboard password to access the administrative controls.</p>

        <div className="admin-login-note">
          <strong>Security Architecture:</strong>
          <br />
          The password is a dashboard UI gate. All privileged on-chain operations are strictly enforced by smart contract <code>msg.sender == admin</code> on Bohr Testnet.
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <input
            className="form-input"
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn--primary" type="submit" disabled={checking || !password}>
            {checking ? 'Verifying…' : 'Access Dashboard'}
          </button>
        </form>

        <div className="admin-login-footer">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowResetModal(true)}
          >
            Forgot / Reset Password?
          </button>
          {isCustomPasswordSet() && (
            <div className="admin-default-hint">
              <span>Custom password active</span>
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Admin Password Reset</h3>
              <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Password resets are authenticated using your <strong>connected contract admin wallet</strong>. A non-admin wallet cannot reset or bypass security.
              </p>

              <div className="wallet-verification-box">
                <div className="verification-row">
                  <span>Connected Wallet:</span>
                  <code>{shortAddress(address ?? '0x')}</code>
                </div>
                <div className="verification-row">
                  <span>Contract Admin:</span>
                  <code>{shortAddress(adminAddress ?? '0x')}</code>
                </div>
                <div className="verification-row">
                  <span>Authorization Status:</span>
                  {isAdmin ? (
                    <span className="badge badge--success">✓ Verified Admin Wallet</span>
                  ) : (
                    <span className="badge badge--error">✗ Not Admin Wallet</span>
                  )}
                </div>
              </div>

              {!isAdmin ? (
                <div className="alert alert--error alert--sm" style={{ marginTop: '12px' }}>
                  Please connect the deployer/admin wallet (<code>{shortAddress(adminAddress ?? '0x')}</code>) to reset the dashboard password.
                </div>
              ) : (
                <div className="reset-options">
                  <div className="form-field">
                    <label className="form-label">Set New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmResetPassword}
                      onChange={(e) => setConfirmResetPassword(e.target.value)}
                    />
                  </div>

                  {resetError && <p className="form-error">{resetError}</p>}
                  {resetSuccess && <p className="form-success">{resetSuccess}</p>}

                  <div className="form-actions" style={{ marginTop: '16px' }}>
                    <button
                      className="btn btn--primary"
                      onClick={() => handleWalletReset(false)}
                      disabled={!newResetPassword || newResetPassword.length < 6}
                    >
                      Save New Password
                    </button>
                    <button
                      className="btn btn--outline"
                      onClick={() => handleWalletReset(true)}
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 2. Create Task Form
// ============================================================
function CreateTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirement, setRequirement] = useState('');
  const [rewardBOT, setRewardBOT] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const { createTask, isPending, isConfirming, isSuccess, hash, reset } = useCreateTask();

  const handleCreate = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      const reward = parseEther(rewardBOT || '0');
      await createTask(title.trim(), description.trim(), requirement.trim(), reward);
      setTxStatus('pending');
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  useEffect(() => {
    if (isSuccess && txStatus === 'pending') {
      setTxStatus('success');
      setTitle('');
      setDescription('');
      setRequirement('');
      setRewardBOT('');
      onCreated();
    }
  }, [isSuccess]);

  return (
    <div className="card create-form">
      <h3>Create New Earning Task</h3>
      <div className="form-field">
        <label className="form-label">Task Title *</label>
        <input
          className="form-input"
          placeholder="e.g. Complete Web3 Beginner Quiz"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label">Description *</label>
        <textarea
          className="form-input"
          placeholder="Explain what the task is about..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="form-field">
        <label className="form-label">Requirement *</label>
        <input
          className="form-input"
          placeholder="e.g. Score at least 80% on quiz and paste completion proof"
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label">Reward (BOT) *</label>
        <input
          className="form-input"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="e.g. 10"
          value={rewardBOT}
          onChange={(e) => setRewardBOT(e.target.value)}
        />
      </div>
      <button
        className="btn btn--primary"
        onClick={handleCreate}
        disabled={
          isPending ||
          isConfirming ||
          !title.trim() ||
          !description.trim() ||
          !requirement.trim() ||
          !rewardBOT ||
          Number(rewardBOT) <= 0
        }
      >
        {isPending || isConfirming ? 'Creating Task on Chain…' : '+ Create Task'}
      </button>
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
  );
}

// ============================================================
// 3. Edit Task Modal
// ============================================================
function EditTaskModal({
  task,
  onClose,
  onUpdated,
}: {
  task: Task;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [requirement, setRequirement] = useState(task.requirement);
  const [rewardBOT, setRewardBOT] = useState(formatEther(task.reward));
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const { updateTask, isPending, isConfirming, isSuccess, hash, reset } = useUpdateTask();

  const handleUpdate = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      const reward = parseEther(rewardBOT || '0');
      await updateTask(task.id, title.trim(), description.trim(), requirement.trim(), reward);
      setTxStatus('pending');
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  useEffect(() => {
    if (isSuccess && txStatus === 'pending') {
      setTxStatus('success');
      onUpdated();
    }
  }, [isSuccess]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Task #{task.id.toString()}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">Task Title *</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Description *</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Requirement *</label>
            <input className="form-input" value={requirement} onChange={(e) => setRequirement(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Reward (BOT) *</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0.01"
              value={rewardBOT}
              onChange={(e) => setRewardBOT(e.target.value)}
            />
          </div>

          <div className="form-actions" style={{ marginTop: '16px' }}>
            <button
              className="btn btn--primary"
              onClick={handleUpdate}
              disabled={isPending || isConfirming || !title.trim() || !description.trim() || Number(rewardBOT) <= 0}
            >
              {isPending || isConfirming ? 'Updating on Chain…' : 'Save Changes'}
            </button>
            <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
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

// ============================================================
// 4. Task Management Row
// ============================================================
function TaskRow({
  task,
  onEdit,
  onFilterSubmissions,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onFilterSubmissions: (taskId: bigint) => void;
}) {
  const { setActive, isPending } = useSetTaskActive();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');

  const toggleActive = async () => {
    setTxStatus('confirming');
    try {
      await setActive(task.id, !task.active);
      setTxStatus('success');
    } catch {
      setTxStatus('error');
    }
  };

  return (
    <div className={`admin-task-card ${!task.active ? 'admin-task-card--inactive' : ''}`}>
      <div className="admin-task-header">
        <div className="admin-task-title-group">
          <span className="task-id-tag">#{task.id.toString()}</span>
          <h4 className="admin-task-title">{task.title}</h4>
        </div>
        <div className="admin-task-badges">
          <span className="badge badge--earn">+{formatBOT(task.reward)} BOT</span>
          <span className={`badge ${task.active ? 'badge--active' : 'badge--neutral'}`}>
            {task.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <p className="admin-task-desc">{task.description}</p>
      <div className="admin-task-req">
        <strong>Requirement:</strong> {task.requirement}
      </div>

      <div className="admin-task-footer">
        <span className="admin-task-date">Created {relativeTime(task.createdAt)}</span>
        <div className="admin-task-actions">
          <button className="btn btn--ghost btn--sm" onClick={() => onFilterSubmissions(task.id)}>
            Submissions
          </button>
          <button className="btn btn--outline btn--sm" onClick={() => onEdit(task)}>
            Edit
          </button>
          <button
            className={`btn btn--sm ${task.active ? 'btn--ghost' : 'btn--primary'}`}
            onClick={toggleActive}
            disabled={isPending || txStatus === 'confirming'}
          >
            {isPending ? '…' : task.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 5. Completion Review Modal
// ============================================================
function CompletionReviewModal({
  completion,
  onClose,
  onActionComplete,
}: {
  completion: SubmittedCompletion;
  onClose: () => void;
  onActionComplete: () => void;
}) {
  const { approve, isPending: isApproving } = useApproveCompletion();
  const { issueReward, isPending: isIssuing } = useIssueReward();
  const { approveAndIssue, isPending: isDoingBoth } = useApproveAndIssueReward();

  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const isPendingReview = completion.submitted && !completion.approved && !completion.rewarded;
  const isApprovedOnly = completion.approved && !completion.rewarded;
  const isCompleted = completion.rewarded;

  const handleApproveOnly = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      const h = await approve(completion.user, completion.taskId);
      setTxHash(h);
      setTxStatus('success');
      onActionComplete();
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  const handleIssueOnly = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      const h = await issueReward(completion.user, completion.taskId);
      setTxHash(h);
      setTxStatus('success');
      onActionComplete();
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  const handleApproveAndIssue = async () => {
    setTxStatus('confirming');
    setTxError('');
    try {
      const h = await approveAndIssue(completion.user, completion.taskId);
      setTxHash(h);
      setTxStatus('success');
      onActionComplete();
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Review Task Completion</h3>
            <p className="modal-sub">Task #{completion.taskId.toString()} · {completion.taskTitle}</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Status banner */}
          <div className="review-status-banner">
            <div>
              <span className="review-status-label">Current Status</span>
              <h4>
                {isCompleted && '✅ Rewarded & Completed'}
                {isApprovedOnly && '⏳ Approved — Awaiting Reward Issuance'}
                {isPendingReview && '📋 Pending Admin Review'}
              </h4>
            </div>
            <div className="review-reward-box">
              <span>Reward</span>
              <strong>{formatBOT(completion.taskReward)} BOT</strong>
            </div>
          </div>

          {/* User Details */}
          <div className="review-details-grid">
            <div className="review-field">
              <span className="field-title">User Wallet Address</span>
              <div className="field-value-with-link">
                <code>{completion.user}</code>
                <a
                  href={`${EXPLORER_URL}address/${completion.user}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-link"
                >
                  View on Bohr Scan ↗
                </a>
              </div>
            </div>

            <div className="review-field">
              <span className="field-title">Submission Timestamp</span>
              <span className="field-value">
                {formatTimestamp(completion.submittedAt)} ({relativeTime(completion.submittedAt)})
              </span>
            </div>

            <div className="review-field">
              <span className="field-title">Task Requirement</span>
              <p className="field-value field-value--box">{completion.taskRequirement}</p>
            </div>

            <div className="review-field">
              <span className="field-title">User Submitted Proof / Note</span>
              <p className="field-value field-value--proof">
                {completion.proofNote ? completion.proofNote : 'No text note submitted with transaction.'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="review-actions-section">
            <h4>Administrative Decision</h4>
            <div className="review-actions-buttons">
              {isPendingReview && (
                <>
                  <button
                    className="btn btn--primary"
                    onClick={handleApproveAndIssue}
                    disabled={isDoingBoth || isApproving}
                  >
                    {isDoingBoth ? 'Processing…' : '⚡ Approve & Issue Reward (1-Click)'}
                  </button>
                  <button
                    className="btn btn--outline"
                    onClick={handleApproveOnly}
                    disabled={isApproving || isDoingBoth}
                  >
                    {isApproving ? 'Approving…' : 'Approve Only'}
                  </button>
                </>
              )}

              {isApprovedOnly && (
                <button
                  className="btn btn--primary"
                  onClick={handleIssueOnly}
                  disabled={isIssuing}
                >
                  {isIssuing ? 'Issuing…' : '💰 Issue BOT Reward to User'}
                </button>
              )}

              {isCompleted && (
                <div className="alert alert--success alert--sm">
                  ✓ Reward of {formatBOT(completion.taskReward)} BOT has been issued to {shortAddress(completion.user)}.
                </div>
              )}
            </div>
          </div>

          {txStatus !== 'idle' && (
            <TransactionStatus
              status={txStatus}
              hash={txHash}
              error={txError}
              explorerUrl={EXPLORER_URL}
              onClose={() => {
                setTxStatus('idle');
                setTxHash(undefined);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 6. Submissions & Approvals Management (No guessing!)
// ============================================================
function ApprovalsManagement({
  filterTaskId,
  onClearFilter,
}: {
  filterTaskId?: bigint | null;
  onClearFilter: () => void;
}) {
  const { data: completions, isLoading, refetch } = useSubmittedCompletions();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rewarded'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompletion, setSelectedCompletion] = useState<SubmittedCompletion | null>(null);

  // Quick 1-click approve from list
  const { approveAndIssue, isPending: isQuickActing } = useApproveAndIssueReward();
  const [quickTxHash, setQuickTxHash] = useState<`0x${string}` | undefined>();
  const [quickStatus, setQuickStatus] = useState<TxStatus>('idle');
  const [quickError, setQuickError] = useState('');

  const filteredCompletions = useMemo(() => {
    if (!completions) return [];
    return completions.filter((c) => {
      // Filter by task ID if set
      if (filterTaskId !== undefined && filterTaskId !== null && c.taskId !== filterTaskId) {
        return false;
      }

      // Filter by status tab
      if (statusFilter === 'pending' && (!c.submitted || c.approved || c.rewarded)) return false;
      if (statusFilter === 'approved' && (!c.approved || c.rewarded)) return false;
      if (statusFilter === 'rewarded' && !c.rewarded) return false;

      // Filter by search term
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchesUser = c.user.toLowerCase().includes(s);
        const matchesTask = c.taskTitle.toLowerCase().includes(s) || c.taskId.toString().includes(s);
        const matchesProof = c.proofNote.toLowerCase().includes(s);
        if (!matchesUser && !matchesTask && !matchesProof) return false;
      }

      return true;
    });
  }, [completions, filterTaskId, statusFilter, searchTerm]);

  const pendingCount = completions?.filter((c) => c.submitted && !c.approved && !c.rewarded).length ?? 0;
  const approvedCount = completions?.filter((c) => c.approved && !c.rewarded).length ?? 0;
  const rewardedCount = completions?.filter((c) => c.rewarded).length ?? 0;

  const handleQuickApprove = async (c: SubmittedCompletion) => {
    setQuickStatus('confirming');
    setQuickError('');
    try {
      const h = await approveAndIssue(c.user, c.taskId);
      setQuickTxHash(h);
      setQuickStatus('success');
      refetch();
    } catch (e) {
      setQuickStatus('error');
      setQuickError(parseContractError(e));
    }
  };

  return (
    <div className="approvals-container">
      {/* Header controls */}
      <div className="approvals-header">
        <div className="approvals-filter-tabs">
          <button
            className={`filter-btn ${statusFilter === 'pending' ? 'filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            📋 Pending Review ({pendingCount})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'approved' ? 'filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            ⏳ Approved ({approvedCount})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'rewarded' ? 'filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('rewarded')}
          >
            ✅ Rewarded ({rewardedCount})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({completions?.length ?? 0})
          </button>
        </div>

        <div className="approvals-search-box">
          <input
            className="form-input form-input--sm"
            placeholder="Search by user (0x...), task title, ID or proof note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn btn--ghost btn--sm" onClick={() => refetch()}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {filterTaskId && (
        <div className="task-filter-banner">
          <span>Filtered to Task #{filterTaskId.toString()}</span>
          <button className="btn btn--ghost btn--sm" onClick={onClearFilter}>
            Show All Tasks
          </button>
        </div>
      )}

      {quickStatus !== 'idle' && (
        <TransactionStatus
          status={quickStatus}
          hash={quickTxHash}
          error={quickError}
          explorerUrl={EXPLORER_URL}
          onClose={() => {
            setQuickStatus('idle');
            setQuickTxHash(undefined);
          }}
        />
      )}

      {/* Completions list */}
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Scanning Bohr Testnet for task completions…</p>
        </div>
      ) : filteredCompletions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h3>No Completions Found</h3>
          <p>
            {statusFilter === 'pending'
              ? 'There are no pending task completions awaiting review.'
              : 'No task submissions match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="completions-table-wrap">
          <div className="completions-grid">
            {filteredCompletions.map((c) => {
              const isPending = c.submitted && !c.approved && !c.rewarded;
              const isApproved = c.approved && !c.rewarded;
              const isRewarded = c.rewarded;

              return (
                <div key={`${c.user}-${c.taskId.toString()}`} className="completion-card">
                  <div className="completion-card-top">
                    <div>
                      <div className="completion-user">
                        <span className="user-icon">👤</span>
                        <strong>{shortAddress(c.user)}</strong>
                        <a
                          href={`${EXPLORER_URL}address/${c.user}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="address-link"
                          title="View on Bohr Scan"
                        >
                          ↗
                        </a>
                      </div>
                      <h4 className="completion-task-title">{c.taskTitle}</h4>
                      <span className="completion-task-sub">Task #{c.taskId.toString()}</span>
                    </div>

                    <div className="completion-card-badges">
                      <span className="badge badge--earn">+{formatBOT(c.taskReward)} BOT</span>
                      {isPending && <span className="badge badge--warning">Pending Review</span>}
                      {isApproved && <span className="badge badge--info">Approved</span>}
                      {isRewarded && <span className="badge badge--success">Rewarded</span>}
                    </div>
                  </div>

                  {c.proofNote && (
                    <div className="completion-proof-preview">
                      <strong>Proof Note:</strong> "{c.proofNote}"
                    </div>
                  )}

                  <div className="completion-card-footer">
                    <span className="completion-date">Submitted {relativeTime(c.submittedAt)}</span>
                    <div className="completion-card-actions">
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() => setSelectedCompletion(c)}
                      >
                        Review Details
                      </button>
                      {isPending && (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => handleQuickApprove(c)}
                          disabled={isQuickActing}
                        >
                          Approve & Issue
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedCompletion && (
        <CompletionReviewModal
          completion={selectedCompletion}
          onClose={() => setSelectedCompletion(null)}
          onActionComplete={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 7. Password Management Section
// ============================================================
function PasswordSettingsSection() {
  const { address } = useAccount();
  const { adminAddress, isAdmin } = useAdmin();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setIsUpdating(true);

    const isCurrentValid = await verifyAdminPassword(currentPassword);
    if (!isCurrentValid) {
      setErrorMessage('Current password is incorrect.');
      setIsUpdating(false);
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      setIsUpdating(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      setIsUpdating(false);
      return;
    }

    await updateAdminPassword(newPassword);
    setStatusMessage('Admin dashboard password successfully changed!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsUpdating(false);
  };

  const handleResetDefault = () => {
    resetAdminPassword();
    setStatusMessage('Admin password reset to default configuration.');
    setErrorMessage('');
  };

  return (
    <div className="card password-settings-card">
      <div className="settings-header">
        <div className="settings-icon">🛡️</div>
        <div>
          <h3>Admin Dashboard Password Settings</h3>
          <p className="settings-sub">
            Update or reset the authentication password required to open the Admin Dashboard.
          </p>
        </div>
      </div>

      <div className="security-notice-box">
        <h4>🔒 Security Model</h4>
        <p>
          The dashboard password protects the web user interface. The smart contract on Bohr Testnet strictly enforces that all state-modifying admin functions (task creation, reward approvals, pool withdrawals) can only be executed by the verified contract owner wallet (<code>{shortAddress(adminAddress ?? '0x')}</code>).
        </p>
      </div>

      <form onSubmit={handleUpdatePassword} className="password-form">
        <div className="form-field">
          <label className="form-label">Current Password *</label>
          <input
            className="form-input"
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label">New Password *</label>
          <input
            className="form-input"
            type="password"
            placeholder="Enter new password (min 6 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Confirm New Password *</label>
          <input
            className="form-input"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {statusMessage && <p className="form-success">{statusMessage}</p>}

        <div className="form-actions" style={{ marginTop: '16px' }}>
          <button
            className="btn btn--primary"
            type="submit"
            disabled={isUpdating || !currentPassword || !newPassword || !confirmPassword}
          >
            {isUpdating ? 'Updating…' : 'Update Password'}
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleResetDefault}
          >
            Reset to Default
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// 8. Fund Reward Pool Section
// ============================================================
function FundPool({ poolBalance }: { poolBalance: bigint }) {
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState('');
  const { fund, isPending, isConfirming, isSuccess, hash } = useFundRewardPool();

  const handleFund = async (val?: string) => {
    const fundingVal = val || amount;
    setTxStatus('confirming');
    setTxError('');
    try {
      await fund(parseEther(fundingVal || '0'));
      setTxStatus('pending');
    } catch (e) {
      setTxStatus('error');
      setTxError(parseContractError(e));
    }
  };

  useEffect(() => {
    if (isSuccess && txStatus === 'pending') {
      setTxStatus('success');
      setAmount('');
    }
  }, [isSuccess]);

  return (
    <div className="card">
      <h3>Fund Platform Reward Pool</h3>
      <p className="form-hint">
        Fund the contract with native BOT so approved users receive real rewards upon task verification.
      </p>

      <div className="pool-balance-card">
        <span className="card-label">Current Available Reward Pool</span>
        <div className="card-value">{formatBOT(poolBalance)} <span className="unit">BOT</span></div>
      </div>

      <div className="quick-fund-buttons">
        <span>Quick Add:</span>
        <button className="btn btn--ghost btn--sm" onClick={() => handleFund('10')}>+10 BOT</button>
        <button className="btn btn--ghost btn--sm" onClick={() => handleFund('25')}>+25 BOT</button>
        <button className="btn btn--ghost btn--sm" onClick={() => handleFund('50')}>+50 BOT</button>
        <button className="btn btn--ghost btn--sm" onClick={() => handleFund('100')}>+100 BOT</button>
      </div>

      <div className="form-field" style={{ marginTop: '16px' }}>
        <label className="form-label">Custom Amount (BOT)</label>
        <input
          className="form-input"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="e.g. 50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button
        className="btn btn--primary"
        onClick={() => handleFund()}
        disabled={isPending || isConfirming || !amount || Number(amount) <= 0}
      >
        {isPending || isConfirming ? 'Funding Pool…' : 'Fund Reward Pool'}
      </button>

      {txStatus !== 'idle' && (
        <TransactionStatus
          status={txStatus}
          hash={hash}
          error={txError}
          explorerUrl={EXPLORER_URL}
          onClose={() => setTxStatus('idle')}
        />
      )}
    </div>
  );
}

// ============================================================
// 9. Main Admin Dashboard
// ============================================================
export default function Admin() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === CHAIN_ID;
  const { adminAddress, isAdmin } = useAdmin();
  const stats = usePlatformStats();
  const { tasks, refetch: refetchTasks } = useTasks();
  const { data: recentEvents } = useAllRecentEvents();
  const { data: completions } = useSubmittedCompletions();

  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('etp_admin_auth') === '1');
  const [activeTab, setActiveTab] = useState<'approvals' | 'tasks' | 'pool' | 'activity' | 'security'>('approvals');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterTaskId, setFilterTaskId] = useState<bigint | null>(null);

  const pendingApprovalsCount = completions?.filter((c) => c.submitted && !c.approved && !c.rewarded).length ?? 0;

  if (!isConnected || !isCorrectNetwork) {
    return (
      <div className="page page-admin">
        <div className="page-header">
          <h1 className="page-title">Admin Dashboard</h1>
        </div>
        <div className="alert alert--info">
          {!isConnected ? (
            <>
              <strong>Connect your wallet</strong> to access the admin dashboard.
              <div style={{ marginTop: '12px' }}><appkit-button /></div>
            </>
          ) : (
            <strong>Wrong Network</strong>
          )}
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="page page-admin">
        <AdminLogin onAuth={() => setAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="page page-admin">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Admin Dashboard</h1>
          <div className="admin-header-meta">
            {isAdmin ? (
              <span className="badge badge--success">✓ Verified Contract Admin</span>
            ) : (
              <span className="badge badge--error">✗ Not Contract Owner</span>
            )}
            <span className="wallet-address">{shortAddress(address!)}</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                sessionStorage.removeItem('etp_admin_auth');
                setAuthenticated(false);
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="alert alert--warning">
          <strong>Warning:</strong> Your wallet (<code>{shortAddress(address!)}</code>) does not match the deployed contract admin (<code>{shortAddress(adminAddress ?? '0x')}</code>). Privileged on-chain transactions will revert.
        </div>
      )}

      {/* Platform Statistics */}
      {stats && (
        <div className="cards-grid cards-grid--4">
          <div className="card">
            <div className="card-label">Pending Reviews</div>
            <div className="card-value card-value--pending">{pendingApprovalsCount}</div>
          </div>
          <div className="card">
            <div className="card-label">Available Reward Pool</div>
            <div className="card-value">{formatBOT(stats.rewardPool)} <span className="unit">BOT</span></div>
          </div>
          <div className="card">
            <div className="card-label">Total Rewards Issued</div>
            <div className="card-value">{formatBOT(stats.totalRewardsIssued)} <span className="unit">BOT</span></div>
          </div>
          <div className="card">
            <div className="card-label">Active Tasks</div>
            <div className="card-value">{tasks.filter((t) => t.active).length} / {stats.taskCount.toString()}</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'approvals' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          ✅ Task Approvals {pendingApprovalsCount > 0 && <span className="tab-badge">{pendingApprovalsCount}</span>}
        </button>
        <button
          className={`admin-tab ${activeTab === 'tasks' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📋 Task Management ({tasks.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'pool' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('pool')}
        >
          💰 Reward Pool
        </button>
        <button
          className={`admin-tab ${activeTab === 'activity' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          📊 On-Chain Activity
        </button>
        <button
          className={`admin-tab ${activeTab === 'security' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🛡️ Password & Security
        </button>
      </div>

      {/* 1. Approvals Tab (AUTOMATIC RETRIEVAL, NO GUESSING) */}
      {activeTab === 'approvals' && (
        <div className="admin-section">
          <ApprovalsManagement
            filterTaskId={filterTaskId}
            onClearFilter={() => setFilterTaskId(null)}
          />
        </div>
      )}

      {/* 2. Tasks Management Tab */}
      {activeTab === 'tasks' && (
        <div className="admin-section">
          <CreateTaskForm onCreated={refetchTasks} />
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-header-flex">
              <h3>All Earning Tasks ({tasks.length})</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => refetchTasks()}>
                🔄 Refresh
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="empty-inline">No tasks created yet.</p>
            ) : (
              <div className="admin-tasks-grid">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id.toString()}
                    task={task}
                    onEdit={(t) => setEditingTask(t)}
                    onFilterSubmissions={(taskId) => {
                      setFilterTaskId(taskId);
                      setActiveTab('approvals');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Reward Pool Tab */}
      {activeTab === 'pool' && stats && (
        <div className="admin-section">
          <FundPool poolBalance={stats.rewardPool} />
          <div className="cards-grid cards-grid--3" style={{ marginTop: '24px' }}>
            <div className="card">
              <div className="card-label">Available Reward Pool</div>
              <div className="card-value">{formatBOT(stats.rewardPool)} BOT</div>
              <div className="card-sub">Usable for future task rewards</div>
            </div>
            <div className="card">
              <div className="card-label">Total Rewards Issued</div>
              <div className="card-value">{formatBOT(stats.totalRewardsIssued)} BOT</div>
              <div className="card-sub">Distributed to users</div>
            </div>
            <div className="card">
              <div className="card-label">Total Contract BOT</div>
              <div className="card-value">{formatBOT(stats.contractBalance)} BOT</div>
              <div className="card-sub">Overall on-chain reserve</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Activity Tab */}
      {activeTab === 'activity' && (
        <div className="admin-section">
          {!recentEvents || recentEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No platform activity recorded yet</h3>
            </div>
          ) : (
            <div className="activity-list activity-list--full">
              {recentEvents.map((event, i) => (
                <div key={`${event.txHash}-${i}`} className={`activity-item activity-item--${event.type}`}>
                  <div className="activity-icon-lg">
                    {event.type === 'reward' ? '✅' : event.type === 'payment' ? '💳' : '📝'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">
                      {event.type === 'reward' && `+${formatBOT(event.amount ?? 0n)} BOT reward (Task #${event.taskId?.toString()})`}
                      {event.type === 'payment' && `-${formatBOT(event.amount ?? 0n)} BOT payment`}
                      {event.type === 'submission' && `Task #${event.taskId?.toString()} submitted`}
                    </div>
                    {event.counterparty && (
                      <div className="activity-sub">{shortAddress(event.counterparty)}</div>
                    )}
                    <div className="activity-meta">
                      <span className="activity-time">{formatTimestamp(event.timestamp ?? 0n)}</span>
                      <a href={`${EXPLORER_URL}tx/${event.txHash}`} target="_blank" rel="noopener noreferrer" className="activity-tx">
                        {event.txHash.slice(0, 8)}…{event.txHash.slice(-6)} ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Security & Password Settings Tab */}
      {activeTab === 'security' && (
        <div className="admin-section">
          <PasswordSettingsSection />
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onUpdated={() => {
            setEditingTask(null);
            refetchTasks();
          }}
        />
      )}
    </div>
  );
}
