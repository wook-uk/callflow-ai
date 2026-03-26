// hooks/useCall.ts
import useSWR from 'swr'
import { getCall } from '@/lib/api'

export function useCall(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/calls/${id}` : null,
    () => getCall(id),
    {
      refreshInterval: (data: any) => {
        if (!data) return 3000
        const processing = ['uploading', 'transcribing', 'analyzing', 'crm_syncing']
        return processing.includes(data.status) ? 3000 : 0
      },
    }
  )

  return { call: data, isLoading, error, mutate }
}
