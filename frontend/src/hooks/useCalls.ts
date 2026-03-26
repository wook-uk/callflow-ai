// hooks/useCalls.ts
import useSWR from 'swr'
import { listCalls, CallSummary } from '@/lib/api'

export function useCalls(statusFilter?: string | null) {
  const key = statusFilter ? `/calls?status=${statusFilter}` : '/calls'
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => listCalls(statusFilter ? { status_filter: statusFilter } : undefined),
    { refreshInterval: 5000 } // Poll every 5s while processing calls are in-flight
  )

  return {
    calls: data?.calls as CallSummary[] | undefined,
    isLoading,
    error,
    mutate,
  }
}
