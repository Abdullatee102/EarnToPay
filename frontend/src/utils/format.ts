import { formatEther } from 'viem';

export const DEFAULT_ADMIN_PASSWORD_HASH = '1c5b945254a4ac63754a2a8fa66241cfa4521463cbf7f62dc976fe990b5ce2e9';

/**
 * Format a bigint wei value to a human-readable BOT string
 */
export function formatBOT(wei: bigint, decimals = 4): string {
  const ether = formatEther(wei);
  const num = parseFloat(ether);
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Shorten an address for display
 */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Format a unix timestamp to a readable date
 */
export function formatTimestamp(ts: bigint): string {
  if (!ts || ts === 0n) return '—';
  const ms = Number(ts) * 1000;
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Format a unix timestamp as relative time
 */
export function relativeTime(ts: bigint): string {
  if (!ts || ts === 0n) return '—';
  const now = Date.now();
  const then = Number(ts) * 1000;
  const diff = now - then;
  const abs = Math.abs(diff);

  if (abs < 60_000) return 'just now';
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ago`;
  return `${Math.round(abs / 86_400_000)}d ago`;
}

/**
 * SHA-256 hash of a string (for admin password)
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the currently active admin password hash
 */
export function getActiveAdminHash(): string {
  return (
    localStorage.getItem('etp_admin_password_hash') ||
    import.meta.env.VITE_ADMIN_PASSWORD_HASH ||
    DEFAULT_ADMIN_PASSWORD_HASH
  );
}

/**
 * Verify a password against active hash
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = await sha256(password);
  return hash.toLowerCase() === getActiveAdminHash().toLowerCase();
}

/**
 * Update the stored admin password
 */
export async function updateAdminPassword(newPassword: string): Promise<void> {
  const hash = await sha256(newPassword);
  localStorage.setItem('etp_admin_password_hash', hash);
}

/**
 * Reset admin password to default
 */
export function resetAdminPassword(): void {
  localStorage.removeItem('etp_admin_password_hash');
}

/**
 * Check if a custom password is set
 */
export function isCustomPasswordSet(): boolean {
  return !!localStorage.getItem('etp_admin_password_hash');
}

/**
 * Check if a deadline has expired
 */
export function isExpired(deadline: bigint): boolean {
  if (deadline === 0n) return false;
  return Date.now() / 1000 > Number(deadline);
}

/**
 * Get completion status label
 */
export function completionStatus(completion: { submitted: boolean; approved: boolean; rewarded: boolean } | null): string {
  if (!completion || !completion.submitted) return 'Not Started';
  if (completion.rewarded) return 'Rewarded';
  if (completion.approved) return 'Approved — Reward Pending';
  return 'Pending Review';
}

/**
 * Parse a contract error message to human-readable
 */
export function parseContractError(error: unknown): string {
  if (!error) return 'Unknown error';
  const msg = String(error);
  if (msg.includes('NotAdmin')) return 'Only admin can perform this action';
  if (msg.includes('InsufficientEarnedBalance')) return 'Insufficient earned balance';
  if (msg.includes('InsufficientRewardPool')) return 'Reward pool has insufficient funds';
  if (msg.includes('AlreadySubmitted')) return 'You have already submitted this task';
  if (msg.includes('AlreadyRewarded')) return 'Reward already issued for this completion';
  if (msg.includes('AlreadyApproved')) return 'Task completion is already approved';
  if (msg.includes('NotSubmitted')) return 'No submission found for this user/task';
  if (msg.includes('PaymentRequestAlreadyPaid')) return 'Payment request already paid';
  if (msg.includes('PaymentRequestExpired')) return 'Payment request has expired';
  if (msg.includes('PaymentRequestNotActive')) return 'Payment request is not active';
  if (msg.includes('TaskNotActive')) return 'Task is not currently active';
  if (msg.includes('TaskNotFound')) return 'Task not found';
  if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('User denied')) return 'Transaction cancelled in wallet';
  if (msg.includes('ConnectorNotConnected')) return 'Please connect your wallet';
  if (msg.includes('TransferFailed')) return 'BOT transfer failed';
  return 'Transaction failed. Please check wallet and try again.';
}
