import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let initialization: Promise<SupabaseClient | null> | null = null

function createConfiguredClient(url: string, publishableKey: string) {
  if (!url || !publishableKey) return null
  if (!client) client = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return client
}

export function getSupabaseClient() {
  return client || createConfiguredClient(__SUPABASE_URL__, __SUPABASE_PUBLISHABLE_KEY__)
}

export function initializeSupabaseClient() {
  const configured = getSupabaseClient()
  if (configured) return Promise.resolve(configured)
  if (!initialization) {
    initialization = fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const configuration = await response.json() as { supabaseUrl?: string; supabasePublishableKey?: string }
        return createConfiguredClient(configuration.supabaseUrl || '', configuration.supabasePublishableKey || '')
      })
      .catch(() => null)
  }
  return initialization
}

export type ConnectionState = 'connecting' | 'connected' | 'local' | 'error'
export type ClassroomEvent = 'scenario' | 'prediction' | 'choice' | 'reset'
type Handler = (payload: Record<string, unknown>) => void

export class ClassroomBus {
  private channel: RealtimeChannel | null = null
  private handlers = new Map<ClassroomEvent, Set<Handler>>()
  private local: BroadcastChannel
  constructor(private room: string, private role: string) {
    this.local = new BroadcastChannel(`deep-learning-classroom:${room}`)
    this.local.onmessage = ({ data }) => this.dispatch(data?.event, data?.payload)
  }
  on(event: ClassroomEvent, handler: Handler) { const set = this.handlers.get(event) || new Set<Handler>(); set.add(handler); this.handlers.set(event, set); return () => set.delete(handler) }
  private dispatch(event: ClassroomEvent, payload: Record<string, unknown>) { this.handlers.get(event)?.forEach((handler) => handler(payload || {})) }
  connect(onState: (state: ConnectionState) => void) {
    const supabase = getSupabaseClient()
    if (!supabase) { onState('local'); return }
    this.channel = supabase.channel(`deep-learning-classroom:${this.room}`)
    ;(['scenario', 'prediction', 'choice', 'reset'] as ClassroomEvent[]).forEach((event) => this.channel?.on('broadcast', { event }, ({ payload }) => this.dispatch(event, payload)))
    this.channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') onState('connected')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.error('Realtime', status, error); onState('error') }
      else onState('connecting')
    })
  }
  async send(event: ClassroomEvent, payload: Record<string, unknown> = {}) {
    const envelope = { ...payload, sender: this.role, sentAt: Date.now() }
    this.local.postMessage({ event, payload: envelope })
    if (this.channel) await this.channel.send({ type: 'broadcast', event, payload: envelope })
  }
  disconnect() { this.local.close(); if (this.channel) void getSupabaseClient()?.removeChannel(this.channel); this.channel = null; this.handlers.clear() }
}

export function sanitizeRoom(value: string | null) { return (value || 'AULA-IA').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18) || 'AULA-IA' }
