import { computed, ref, watch } from 'vue'
import { slugifyName } from '~/utils/format/slug'
import type { QuickRoomInput } from '~/utils/validators/buildings'
import { generateRoomNumbers, type GeneratorError, type RoomGeneratorInput } from '~/utils/rooms/generate-room-numbers'

export type PreviewField = 'floor' | 'rent' | 'area'

export interface PreviewRoom {
  roomNumber: string
  floor: number
  rent: number
  area: number | null
  overridden: PreviewField[]
  existing: boolean
  manual: boolean
}

export function useQuickRoomPreview() {
  const enabled = ref(false)
  const defaultRent = ref(0)
  const defaultArea = ref<number | null>(null)
  const samePrice = ref(true)
  const rows = ref<PreviewRoom[]>([])
  const serverDuplicates = ref<string[]>([])

  const generator = ref<RoomGeneratorInput>({
    floorFrom: 1, floorTo: 1, roomsPerFloor: 3, prefix: 'P', startSeq: 1, includeFloor: false, nameFloorStart: 1,
  })
  const existingRoomNumbers = ref<string[]>([])
  const removed = ref(new Set<string>())
  const manualRows = ref<PreviewRoom[]>([])
  const generated = computed(() => generateRoomNumbers(generator.value))
  const generatorError = computed<GeneratorError | null>(() => generated.value.error)

  function regenerate() {
    if (!enabled.value) {
      rows.value = []
      return
    }
    const previous = new Map(rows.value.map(r => [r.roomNumber, r]))
    const existing = new Set(existingRoomNumbers.value)
    const base = { rent: defaultRent.value, area: defaultArea.value }
    const fromGenerator = generated.value.rooms
      .filter(g => !removed.value.has(g.roomNumber))
      .map((g) => {
        const old = previous.get(g.roomNumber)
        const row: PreviewRoom = {
          roomNumber: g.roomNumber, floor: g.floor, ...base, overridden: [], existing: existing.has(g.roomNumber), manual: false,
        }
        for (const field of old?.overridden ?? []) {
          if (field === 'rent' && samePrice.value) continue
          ;(row[field] as number | null) = old![field]
          row.overridden.push(field)
        }
        return row
      })
    const manual = manualRows.value.map(r => ({ ...r, existing: existing.has(r.roomNumber) }))
    rows.value = [...fromGenerator, ...manual]
  }

  watch([enabled, generator], () => {
    serverDuplicates.value = []
    removed.value = new Set()
    regenerate()
  }, { deep: true, immediate: true })
  watch([defaultRent, defaultArea, samePrice, existingRoomNumbers], regenerate, { deep: true })

  function setCell(roomNumber: string, field: PreviewField, value: number | null) {
    const row = rows.value.find(r => r.roomNumber === roomNumber)
    if (!row) return
    ;(row[field] as number | null) = value
    if (!row.overridden.includes(field)) row.overridden.push(field)
    if (row.manual) {
      const manual = manualRows.value.find(r => r.roomNumber === roomNumber)
      if (manual) { (manual[field] as number | null) = value; if (!manual.overridden.includes(field)) manual.overridden.push(field) }
    }
  }

  function resetCell(roomNumber: string, field: PreviewField) {
    const row = rows.value.find(r => r.roomNumber === roomNumber)
    if (!row) return
    let fallback: number | null
    if (field === 'floor') {
      fallback = generated.value.rooms.find(g => g.roomNumber === roomNumber)?.floor ?? row.floor
    }
    else {
      fallback = field === 'rent' ? defaultRent.value : defaultArea.value
    }
    ;(row[field] as number | null) = fallback
    row.overridden = row.overridden.filter(f => f !== field)
  }

  const duplicateRoomNumbers = computed(() => {
    const seen = new Map<string, string>()
    const dups = new Set<string>()
    for (const r of rows.value) {
      if (r.existing) continue
      const key = slugifyName(r.roomNumber) || r.roomNumber.toLowerCase()
      if (seen.has(key)) dups.add(r.roomNumber)
      else seen.set(key, r.roomNumber)
    }
    return [...dups]
  })

  function markServerDuplicates(roomNumbers: string[]) {
    serverDuplicates.value = roomNumbers
  }

  function removeRow(roomNumber: string) {
    manualRows.value = manualRows.value.filter(r => r.roomNumber !== roomNumber)
    removed.value.add(roomNumber)
    rows.value = rows.value.filter(r => r.roomNumber !== roomNumber)
  }

  function addRow(roomNumber: string, floor: number) {
    const row: PreviewRoom = {
      roomNumber, floor, rent: defaultRent.value, area: defaultArea.value, overridden: [], existing: false, manual: true,
    }
    manualRows.value.push(row)
    regenerate()
  }

  function toPayload(): QuickRoomInput[] {
    return rows.value
      .filter(r => !r.existing)
      .map(r => ({ room_number: r.roomNumber, floor: r.floor, monthly_rent: r.rent, area: r.area }))
  }

  return {
    enabled, defaultRent, defaultArea, samePrice,
    generator, generatorError, existingRoomNumbers,
    rows, duplicateRoomNumbers, serverDuplicates,
    setCell, resetCell, removeRow, addRow, markServerDuplicates, toPayload,
  }
}
