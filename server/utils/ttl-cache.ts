interface CacheEntry<T> {
  expiresAt: number
  value: T
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>()

  constructor(private readonly maxEntries = 200) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= now) {
      this.entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldest = this.entries.keys().next().value
      if (oldest) this.entries.delete(oldest)
    }
    this.entries.set(key, { value, expiresAt: now + ttlMs })
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  deleteMatching(predicate: (key: string) => boolean): void {
    for (const key of this.entries.keys()) {
      if (predicate(key)) this.entries.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
