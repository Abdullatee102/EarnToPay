import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID } from '../config/contracts';

export function usePaymentRequestCount() {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'paymentRequestCount',
    chainId: CHAIN_ID,
  });
  return data ?? 0n;
}

export function usePaymentRequests() {
  const count = usePaymentRequestCount();
  const { data: requests, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPaymentRequests',
    args: [1n, count > 0n ? count : 1n],
    query: { enabled: count > 0n },
    chainId: CHAIN_ID,
  });
  return { requests: requests ?? [], isLoading, refetch };
}

export function usePaymentRequest(requestId?: bigint) {
  const { data, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPaymentRequest',
    args: requestId !== undefined ? [requestId] : undefined,
    query: { enabled: requestId !== undefined },
    chainId: CHAIN_ID,
  });
  return { request: data, refetch };
}

export function useCreatePaymentRequest() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createRequest = async (
    amount: bigint,
    title: string,
    description: string,
    deadline: bigint
  ) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'createPaymentRequest',
      args: [amount, title, description, deadline],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { createRequest, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function usePayRequest() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending, data: hash, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const pay = async (requestId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'payRequest',
      args: [requestId],
    });
  };

  if (isSuccess) {
    qc.invalidateQueries();
  }

  return { pay, isPending, isConfirming, isSuccess, hash, error, reset };
}

