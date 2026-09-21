import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACT_ADDRESS } from '../config/contracts';
import { CHAIN_ID } from '../config/contracts';
import type { ActivityEvent } from '../types';

export function useActivityEvents(userAddress?: `0x${string}`) {
  const client = usePublicClient({ chainId: CHAIN_ID });

  return useQuery({
    queryKey: ['activity', userAddress, CONTRACT_ADDRESS],
    enabled: !!userAddress && !!client,
    staleTime: 15_000,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!client || !userAddress) return [];
      const events: ActivityEvent[] = [];

      try {
        // 1. Rewards received
        const rewardLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'RewardIssued',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'taskId', type: 'uint256', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          args: { user: userAddress },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of rewardLogs) {
          events.push({
            type: 'reward',
            amount: log.args.amount,
            taskId: log.args.taskId,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        // 2. Withdrawals made
        const withdrawLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'RewardWithdrawn',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'destination', type: 'address', indexed: true },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          args: { user: userAddress },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of withdrawLogs) {
          events.push({
            type: 'withdrawal',
            amount: log.args.amount,
            counterparty: log.args.destination,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        // 3. Payments made
        const paymentLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'PaymentCompleted',
            inputs: [
              { name: 'requestId', type: 'uint256', indexed: true },
              { name: 'payer', type: 'address', indexed: true },
              { name: 'merchant', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          args: { payer: userAddress },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of paymentLogs) {
          events.push({
            type: 'payment',
            amount: log.args.amount,
            requestId: log.args.requestId,
            counterparty: log.args.merchant,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        // 4. Task submissions
        const submissionLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'CompletionSubmitted',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'taskId', type: 'uint256', indexed: true },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          args: { user: userAddress },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of submissionLogs) {
          events.push({
            type: 'submission',
            taskId: log.args.taskId,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        // Sort by timestamp desc
        return events.sort((a, b) => {
          const ta = a.timestamp ?? 0n;
          const tb = b.timestamp ?? 0n;
          return tb > ta ? 1 : tb < ta ? -1 : 0;
        });
      } catch {
        return events;
      }
    },
  });
}

export function useAllRecentEvents() {
  const client = usePublicClient({ chainId: CHAIN_ID });

  return useQuery({
    queryKey: ['all-events', CONTRACT_ADDRESS],
    enabled: !!client,
    staleTime: 15_000,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!client) return [];
      const events: ActivityEvent[] = [];

      try {
        const rewardLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'RewardIssued',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'taskId', type: 'uint256', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of rewardLogs) {
          events.push({
            type: 'reward',
            amount: log.args.amount,
            taskId: log.args.taskId,
            counterparty: log.args.user as `0x${string}`,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        const withdrawLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'RewardWithdrawn',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'destination', type: 'address', indexed: true },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of withdrawLogs) {
          events.push({
            type: 'withdrawal',
            amount: log.args.amount,
            counterparty: log.args.user as `0x${string}`,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        const paymentLogs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'PaymentCompleted',
            inputs: [
              { name: 'requestId', type: 'uint256', indexed: true },
              { name: 'payer', type: 'address', indexed: true },
              { name: 'merchant', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false },
            ],
          } as const,
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        for (const log of paymentLogs) {
          events.push({
            type: 'payment',
            amount: log.args.amount,
            requestId: log.args.requestId,
            counterparty: log.args.merchant,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp,
          });
        }

        return events.sort((a, b) => {
          const ta = a.timestamp ?? 0n;
          const tb = b.timestamp ?? 0n;
          return tb > ta ? 1 : tb < ta ? -1 : 0;
        });
      } catch {
        return events;
      }
    },
  });
}
