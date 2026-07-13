const baseUrl = process.env.BENCHMARK_BASE_URL
const cookie = process.env.BENCHMARK_COOKIE
if (!baseUrl || !cookie) {
  throw new Error('Set BENCHMARK_BASE_URL and BENCHMARK_COOKIE for an authenticated production-like environment')
}

const routes = JSON.parse(process.env.BENCHMARK_ROUTES ?? '["/api/dashboard/summary"]')
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 30)

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}

for (const route of routes) {
  const durations = []
  const serverDurations = []
  const dbRoundTrips = []
  const responseBytes = []
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now()
    const response = await fetch(new URL(route, baseUrl), { headers: { cookie } })
    const body = await response.arrayBuffer()
    durations.push(performance.now() - start)
    responseBytes.push(body.byteLength)
    const timing = response.headers.get('server-timing') ?? ''
    const appDuration = timing.match(/app;dur=([\d.]+)/)?.[1]
    const dbCount = timing.match(/db;[^,]*;dur=([\d.]+)/)?.[1]
    if (appDuration) serverDurations.push(Number(appDuration))
    if (dbCount) dbRoundTrips.push(Number(dbCount))
    if (!response.ok) throw new Error(`${route} returned ${response.status}`)
  }
  const result = {
    route,
    iterations,
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    maxMs: Math.round(Math.max(...durations)),
    serverP95Ms: serverDurations.length ? Math.round(percentile(serverDurations, 0.95)) : null,
    maxDbRoundTrips: dbRoundTrips.length ? Math.max(...dbRoundTrips) : null,
    maxResponseBytes: Math.max(...responseBytes),
  }
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
