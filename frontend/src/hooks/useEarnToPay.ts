import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { CHAIN_ID } from '../config/contracts';

export function useAdmin() {
  const { address } = useAccount();

  const { data: adminAddress } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'admin',
    chainId: CHAIN_ID,
  });

  const isAdmin = !!(address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase());

  return { adminAddress, isAdmin };
}

export function useUserBalances(userAddress?: `0x${string}`) {
  const { data: earnedBalance, refetch: refetchEarned } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'earnedBalance',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
    chainId: CHAIN_ID,
  });

  const { data: totalEarned } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'totalEarned',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
    chainId: CHAIN_ID,
  });

  const { data: totalSpent } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'totalSpent',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
    chainId: CHAIN_ID,
  });

  const { data: totalWithdrawn } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'totalWithdrawn',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
    chainId: CHAIN_ID,
  });

  return {
    earnedBalance: earnedBalance ?? 0n,
    totalEarned: totalEarned ?? 0n,
    totalSpent: totalSpent ?? 0n,
    totalWithdrawn: totalWithdrawn ?? 0n,
    refetch: refetchEarned,
  };
}

export function usePlatformStats() {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPlatformStats',
    chainId: CHAIN_ID,
  });

  if (!data) return null;
  const [taskCount, paymentRequestCount, rewardPool, totalRewardsIssued, totalPaymentsVolume, contractBalance] = data;
  return { taskCount, paymentRequestCount, rewardPool, totalRewardsIssued, totalPaymentsVolume, contractBalance };
}

export function useSubmitCompletion() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = async (taskId: bigint, proofNote: string) => {
    const h = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'submitCompletion',
      args: [taskId, proofNote],
    });
    return h;
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { submit, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useWithdrawEarned() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdraw = async (amount: bigint) => {
    const h = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'withdrawEarned',
      args: [amount],
    });
    return h;
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { withdraw, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useFundRewardPool() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fund = async (amount: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'fundRewardPool',
      value: amount,
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { fund, isPending, isConfirming, isSuccess, hash, error };
}
