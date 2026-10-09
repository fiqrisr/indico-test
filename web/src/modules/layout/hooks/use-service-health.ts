import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api-client'

interface HealthResponse {
  status: string
}

export function useServiceHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => request<HealthResponse>('/health'),
    refetchInterval: 10000,
    retry: 2,
  })
}
