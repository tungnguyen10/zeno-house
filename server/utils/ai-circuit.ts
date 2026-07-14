interface CircuitState {
  consecutiveFailures: number
  openedAt: number | null
}

const states = new Map<string, CircuitState>()

function stateFor(provider: string): CircuitState {
  const existing = states.get(provider)
  if (existing) return existing
  const state = { consecutiveFailures: 0, openedAt: null }
  states.set(provider, state)
  return state
}

export function assertAiProviderCircuitClosed(
  provider: string,
  threshold: number,
  cooldownMs: number,
  now = Date.now(),
): void {
  const state = stateFor(provider)
  if (state.openedAt === null) return
  if (now - state.openedAt >= cooldownMs) {
    state.consecutiveFailures = Math.max(0, threshold - 1)
    state.openedAt = null
    return
  }
  throw createError({
    statusCode: 503,
    data: { error: { code: 'INTERNAL', message: 'Nhà cung cấp AI đang tạm nghỉ. Vui lòng thử lại sau.' } },
  })
}

export function recordAiProviderFailure(provider: string, threshold: number, now = Date.now()): void {
  const state = stateFor(provider)
  state.consecutiveFailures += 1
  if (state.consecutiveFailures >= threshold && state.openedAt === null) state.openedAt = now
}

export function recordAiProviderSuccess(provider: string): void {
  states.set(provider, { consecutiveFailures: 0, openedAt: null })
}

export function resetAiProviderCircuits(): void {
  states.clear()
}
