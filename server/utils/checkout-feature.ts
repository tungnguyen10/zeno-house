import type { H3Event } from 'h3'

/** Opt-in, server-owned building rollout. An empty allowlist enables no building. */
export function checkoutEnabledForBuilding(event: H3Event, buildingId: string): boolean {
  const config = useRuntimeConfig(event)
  const enabled = config.checkoutEnabled === true || String(config.checkoutEnabled) === 'true'
  const allowed = String(config.checkoutBuildingIds ?? '').split(',').map(value => value.trim()).filter(Boolean)
  return enabled && allowed.includes(buildingId)
}
