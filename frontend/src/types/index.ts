export interface Task {
  id: bigint;
  title: string;
  description: string;
  requirement: string;
  reward: bigint;
  active: boolean;
  createdAt: bigint;
}

export interface Completion {
  user: `0x${string}`;
  taskId: bigint;
  submitted: boolean;
  approved: boolean;
  rewarded: boolean;
  submittedAt: bigint;
  proofNote: string;
}

export interface SubmittedCompletion {
  user: `0x${string}`;
  taskId: bigint;
  taskTitle: string;
  taskDescription: string;
  taskRequirement: string;
  taskReward: bigint;
  submitted: boolean;
  approved: boolean;
  rewarded: boolean;
  submittedAt: bigint;
  proofNote: string;
  txHash?: `0x${string}`;
}

export interface PaymentRequest {
  id: bigint;
  merchant: `0x${string}`;
  amount: bigint;
  title: string;
  description: string;
  deadline: bigint;
  paid: boolean;
  active: boolean;
  paidBy: `0x${string}`;
  createdAt: bigint;
}

export interface PlatformStats {
  taskCount: bigint;
  paymentRequestCount: bigint;
  rewardPool: bigint;
  totalRewardsIssued: bigint;
  totalPaymentsVolume: bigint;
  contractBalance: bigint;
}

export type TxStatus = 'idle' | 'confirming' | 'pending' | 'success' | 'error';

export interface ActivityEvent {
  type: 'reward' | 'payment' | 'submission' | 'withdrawal';
  amount?: bigint;
  taskId?: bigint;
  requestId?: bigint;
  counterparty?: `0x${string}`;
  txHash: `0x${string}`;
  timestamp?: bigint;
  title?: string;
}
