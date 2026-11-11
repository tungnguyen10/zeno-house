import { computed, ref, watch } from 'vue'
import { slugifyName } from '~/utils/format/slug'
import { QUICK_ROOM_MAX, type QuickRoomInput } from '~/utils/validators/buildings'

export type PreviewField = 'floor' | 'rent' | 'area'

export interface PreviewRoom {
  roomNumber: string
  floor: number
  rent: number
  area: number | null
  overridden: PreviewField[]
}

export function useQuickRoomPreview() {
  const enabled = ref(false)
  const prefix = ref('P')
  const start = ref(101)
  const count = ref(3)
  const defaultRent = ref(0)
  const defaultArea = ref<number | null>(null)
  const defaultFloor = ref(1)
  const samePrice = ref(true)
  const rows = ref<PreviewRoom[]>([])
  const serverDuplicates = ref<string[]>([])

  function defaults(): Pick<PreviewRoom, PreviewField> {
    return { floor: defaultFloor.value, rent: defaultRent.value, area: defaultArea.value }
  }

  function regenerate() {
    const size = Math.min(QUICK_ROOM_MAX, Math.max(1, Math.trunc(count.value) || 1))
    if (size !== count.value) count.value = size
    if (!enabled.value) {
      rows.value = []
      return
    }
    const previous = new Map(rows.value.map(r => [r.roomNumber, r]))
    const base = defaults()
    rows.value = Array.from({ length: size }, (_, i) => {
      const roomNumber = `${prefix.value}${start.value + i}`
      const old = previous.get(roomNumber)
      const row: PreviewRoom = { roomNumber, ...base, overridden: [] }
      if (old) {
        for (const field of old.overridden) {
          if (field === 'rent' && samePrice.value) continue
          if (field === 'area') row.area = old.area
          else row[field] = old[field]
          row.overridden.push(field)
        }
      }
      return row
    })
  }

  watch([enabled, prefix, start, count], () => {
    serverDuplicates.value = []
    regenerate()
  }, { immediate: true })
  watch([defaultRent, defaultArea, defaultFloor], regenerate)
  // Observe each toggle so enabling same-price also resets edits within a Vue batch.
  watch(samePrice, (value) => {
    if (!value) return
    for (const row of rows.value) {
      row.rent = defaultRent.value
      row.overridden = row.overridden.filter(field => field !== 'rent')
    }
  }, { flush: 'sync' })

  function setCell(roomNumber: string, field: PreviewField, value: number | null) {
    const row = rows.value.find(r => r.roomNumber === roomNumber)
    if (!row) return
    if (field === 'area') row.area = value
    else if (value !== null) row[field] = value
    else return
    if (!row.overridden.includes(field)) row.overridden.push(field)
  }

  function resetCell(roomNumber: string, field: PreviewField) {
    const row = rows.value.find(r => r.roomNumber === roomNumber)
    if (!row) return
    if (field === 'area') row.area = defaultArea.value
    else row[field] = defaults()[field]
    row.overridden = row.overridden.filter(f => f !== field)
  }

  const duplicateRoomNumbers = computed(() => {
    const seen = new Map<string, string>()
    const dups = new Set<string>()
    for (const r of rows.value) {
      const key = slugifyName(r.roomNumber) || r.roomNumber.toLowerCase()
      if (seen.has(key)) dups.add(r.roomNumber)
      else seen.set(key, r.roomNumber)
    }
    return [...dups]
  })

  function markServerDuplicates(roomNumbers: string[]) {
    serverDuplicates.value = roomNumbers
  }

  function toPayload(): QuickRoomInput[] {
    return rows.value.map(r => ({ room_number: r.roomNumber, floor: r.floor, monthly_rent: r.rent, area: r.area }))
  }

  return {
    enabled, prefix, start, count, defaultRent, defaultArea, defaultFloor, samePrice,
    rows, duplicateRoomNumbers, serverDuplicates,
    setCell, resetCell, markServerDuplicates, toPayload,
  }
}
