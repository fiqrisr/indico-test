import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query-client'
import { AppShell } from '@/modules/layout/components/app-shell'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}
