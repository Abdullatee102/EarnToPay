import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID } from '../config/contracts';
import type { SubmittedCompletion, Task } from '../types';

export function useTaskCount() {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'taskCount',
    chainId: CHAIN_ID,
  });
  return data ?? 0n;
}

export function useTasks() {
  const count = useTaskCount();
  const { data: tasks, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTasks',
    args: [1n, count > 0n ? count : 1n],
    query: { enabled: count > 0n },
    chainId: CHAIN_ID,
  });
  return { tasks: (tasks as Task[]) ?? [], isLoading, refetch };
}

export function useCompletion(user?: `0x${string}`, taskId?: bigint) {
  const { data, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getCompletion',
    args: user && taskId !== undefined ? [user, taskId] : undefined,
    query: { enabled: !!user && taskId !== undefined },
    chainId: CHAIN_ID,
  });
  return { completion: data, refetch };
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createTask = async (
    title: string,
    description: string,
    requirement: string,
    reward: bigint
  ) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'createTask',
      args: [title, description, requirement, reward],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { createTask, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const updateTask = async (
    taskId: bigint,
    title: string,
    description: string,
    requirement: string,
    reward: bigint
  ) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'updateTask',
      args: [taskId, title, description, requirement, reward],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { updateTask, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useSetTaskActive() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setActive = async (taskId: bigint, active: boolean) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'setTaskActive',
      args: [taskId, active],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { setActive, isPending, isConfirming, isSuccess, hash, error };
}

export function useApproveCompletion() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (user: `0x${string}`, taskId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'approveCompletion',
      args: [user, taskId],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { approve, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useIssueReward() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const issueReward = async (user: `0x${string}`, taskId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'issueReward',
      args: [user, taskId],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { issueReward, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useApproveAndIssueReward() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approveAndIssue = async (user: `0x${string}`, taskId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'approveAndIssueReward',
      args: [user, taskId],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { approveAndIssue, isPending, isConfirming, isSuccess, hash, error, reset };
}

/**
 * Hook to discover and retrieve all task completions across the platform
 * using on-chain logs & direct contract state inspection.
 */
export function useSubmittedCompletions() {
  const client = usePublicClient({ chainId: CHAIN_ID });

  return useQuery({
    queryKey: ['all-submitted-completions', CONTRACT_ADDRESS],
    enabled: !!client,
    staleTime: 10_000,
    queryFn: async (): Promise<SubmittedCompletion[]> => {
      if (!client) return [];

      try {
        // 1. Get all CompletionSubmitted events
        const submitLogs = await client.getLogs({
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
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        if (!submitLogs || submitLogs.length === 0) {
          return [];
        }

        // 2. Deduplicate user + taskId pairs (keeping earliest or latest tx)
        const uniqueKeys = new Map<string, { user: `0x${string}`; taskId: bigint; txHash: `0x${string}`; timestamp: bigint }>();
        for (const log of submitLogs) {
          const user = log.args.user as `0x${string}`;
          const taskId = log.args.taskId as bigint;
          const key = `${user.toLowerCase()}-${taskId.toString()}`;
          uniqueKeys.set(key, {
            user,
            taskId,
            txHash: log.transactionHash,
            timestamp: log.args.timestamp ?? 0n,
          });
        }

        // 3. Query current live state from contract for each unique submission
        const completions: SubmittedCompletion[] = [];

        for (const [, item] of uniqueKeys.entries()) {
          try {
            // Read completion status
            const completionData = await client.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'getCompletion',
              args: [item.user, item.taskId],
            });

            // Read task details
            const taskData = await client.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'getTask',
              args: [item.taskId],
            });

            if (completionData && completionData.submitted) {
              completions.push({
                user: item.user,
                taskId: item.taskId,
                taskTitle: taskData.title || `Task #${item.taskId.toString()}`,
                taskDescription: taskData.description || '',
                taskRequirement: taskData.requirement || '',
                taskReward: taskData.reward ?? 0n,
                submitted: completionData.submitted,
                approved: completionData.approved,
                rewarded: completionData.rewarded,
                submittedAt: completionData.submittedAt > 0n ? completionData.submittedAt : item.timestamp,
                proofNote: completionData.proofNote || '',
                txHash: item.txHash,
              });
            }
          } catch {
            // If individual read fails, skip gracefully
          }
        }

        // 4. Sort newest first
        return completions.sort((a, b) => {
          const ta = a.submittedAt ?? 0n;
          const tb = b.submittedAt ?? 0n;
          return tb > ta ? 1 : tb < ta ? -1 : 0;
        });
      } catch {
        return [];
      }
    },
  });
}
