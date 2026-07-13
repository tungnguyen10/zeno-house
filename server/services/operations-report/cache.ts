import type { OperationsReport } from '~/types/operations-report'
import { TtlCache } from '../../utils/ttl-cache'

const reportCache = new TtlCache<OperationsReport>(500)
const closedVersionByBaseKey = new Map<string, string>()

export function operationsReportCacheKey(
  buildingId: string,
  periodYear: number,
  periodMonth: number,
  includeReserveFund: boolean,
): string {
  return `${buildingId}:${periodYear}:${periodMonth}:reserve-${includeReserveFund ? 'yes' : 'no'}`
}

export function getCachedOperationsReport(key: string): OperationsReport | undefined {
  return reportCache.get(closedVersionByBaseKey.get(key) ?? key)
}

export function cacheOperationsReport(key: string, report: OperationsReport): void {
  if (report.closure.status === 'closed') {
    const version = report.closure.updatedAt ?? report.closure.closedAt ?? 'closed'
    const versionedKey = `${key}:version:${version}`
    closedVersionByBaseKey.set(key, versionedKey)
    reportCache.set(versionedKey, report, 86_400_000)
    return
  }
  closedVersionByBaseKey.delete(key)
  reportCache.set(key, report, 15_000)
}

export function invalidateOperationsReport(buildingId: string): void {
  reportCache.deleteMatching(key => key.startsWith(`${buildingId}:`))
  for (const key of closedVersionByBaseKey.keys()) {
    if (key.startsWith(`${buildingId}:`)) closedVersionByBaseKey.delete(key)
  }
}

export function clearOperationsReportCache(): void {
  reportCache.clear()
  closedVersionByBaseKey.clear()
}
