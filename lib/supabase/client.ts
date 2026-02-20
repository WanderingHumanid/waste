/**
 * Supabase Client Configuration
 * Browser-safe client for real-time features, chat, and messaging
 */

import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

/**
 * Supabase Real-time subscriptions
 */
export const subscribeToMessages = (
  client: ReturnType<typeof createClient>,
  roomId: string,
  onMessage: (message: any) => void
) => {
  return client
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => onMessage(payload.new)
    )
    .subscribe()
}

export const subscribeToMarketplace = (
  client: ReturnType<typeof createClient>,
  onUpdate: (data: any) => void
) => {
  return client
    .channel('marketplace-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'marketplace',
      },
      (payload) => onUpdate(payload)
    )
    .subscribe()
}

export const subscribeToWasteStatus = (
  client: ReturnType<typeof createClient>,
  householdId: string,
  onUpdate: (status: boolean) => void
) => {
  return client
    .channel(`household:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'households',
        filter: `id=eq.${householdId}`,
      },
      (payload) => onUpdate(payload.new?.waste_ready)
    )
    .subscribe()
}

/**
 * Subscribe to all active waste signals (for workers/admin map)
 */
export const subscribeToAllActiveSignals = (
  client: ReturnType<typeof createClient>,
  onChange: (payload: any) => void
) => {
  return client
    .channel('all-active-signals')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'households',
        // We filter for waste_ready transitions or updates to already ready households
      },
      (payload) => onChange(payload)
    )
    .subscribe()
}
