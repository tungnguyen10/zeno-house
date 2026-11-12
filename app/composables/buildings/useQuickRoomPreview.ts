import { computed, ref, watch } from 'vue'
import { slugifyName } from '~/utils/format/slug'
import { generateRoomNumbers, type RoomGeneratorInput } from '~/utils/rooms/generate-room-numbers'
import { QUICK_ROOM_MAX, quickRoomSchema, type QuickRoomInput } from '~/utils/validators/buildings'

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

const roomKey = (roomNumber: string) => slugifyName(roomNumber) || roomNumber.toLowerCase()
const manualRoomSchema = quickRoomSchema.pick({ room_number: true, floor: true })

export function useQuickRoomPreview() {
  const enabled = ref(false)
  const generator = ref<RoomGeneratorInput>({
    floorFrom: 1, floorTo: 1, roomsPerFloor: 3, prefix: 'P', startSeq: 1, includeFloor: false, nameFloorStart: 1,
  })
  const existingRoomNumbers = ref<string[]>([])
  const defaultRent = ref(0)
  const defaultArea = ref<number | null>(null)
  const samePrice = ref(true)
  const rows = ref<PreviewRoom[]>([])
  const serverDuplicates = ref<string[]>([])
  const manualRows = ref<PreviewRoom[]>([])
  const manualFloors = new Map<string, number>()
  const removed = new Set<string>()
  const generated = computed(() => generateRoomNumbers(generator.value))
  const generatorError = computed(() => generated.value.error)
  const existingKeys = computed(() => new Set(existingRoomNumbers.value.map(roomKey)))
  let generatedSet = ''

  function applyDefaults(row: PreviewRoom) {
    if (!row.overridden.includes('rent') || samePrice.value) {
      row.rent = defaultRent.value
      row.overridden = row.overridden.filter(field => field !== 'rent')
    }
    if (!row.overridden.includes('area')) row.area = defaultArea.value
    row.existing = existingKeys.value.has(roomKey(row.roomNumber))
  }

  function filterServerDuplicates() {
    serverDuplicates.value = serverDuplicates.value.filter((number) => {
      const key = roomKey(number)
      return !existingKeys.value.has(key) && !removed.has(key)
    })
  }

  function regenerate() {
    if (!enabled.value) {
      rows.value = []
      return
    }
    const previous = new Map(rows.value.map(row => [row.roomNumber, row]))
    const manualKeys = new Set(manualRows.value.map(row => roomKey(row.roomNumber)))
    const fromGenerator = generated.value.rooms
      .filter(room => !removed.has(roomKey(room.roomNumber)) && !manualKeys.has(roomKey(room.roomNumber)))
      .map((room) => {
        const old = previous.get(room.roomNumber)
        const row: PreviewRoom = { ...room, rent: defaultRent.value, area: defaultArea.value, overridden: [], existing: false, manual: false }
        for (const field of old?.overridden ?? []) {
          if (field === 'area') row.area = old!.area
          else row[field] = old![field]
          row.overridden.push(field)
        }
        applyDefaults(row)
        return row
      })
    // Keep the same manual objects so setCell/resetCell edits survive regeneration.
    manualRows.value.forEach(applyDefaults)
    rows.value = [...fromGenerator, ...manualRows.value]
    filterServerDuplicates()
  }

  watch([enabled, generator], () => {
    serverDuplicates.value = []
    const nextSet = JSON.stringify(generated.value.rooms)
    if (nextSet !== generatedSet) {
      removed.clear()
      generatedSet = nextSet
    }
    regenerate()
  }, { deep: true, immediate: true })
  watch([defaultRent, defaultArea, existingRoomNumbers], regenerate, { deep: true })
  // Observe every toggle, including enabling and disabling within one Vue batch.
  watch(samePrice, (value) => {
    if (!value) return
    for (const row of new Set([...rows.value, ...manualRows.value])) {
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
    else if (field === 'rent') row.rent = defaultRent.value
    else {
      const floor = row.manual ? manualFloors.get(roomNumber) : generated.value.rooms.find(room => room.roomNumber === roomNumber)?.floor
      if (floor === undefined) return
      row.floor = floor
    }
    row.overridden = row.overridden.filter(f => f !== field)
  }

  function removeRow(roomNumber: string) {
    manualRows.value = manualRows.value.filter(row => row.roomNumber !== roomNumber)
    manualFloors.delete(roomNumber)
    removed.add(roomKey(roomNumber))
    rows.value = rows.value.filter(row => row.roomNumber !== roomNumber)
    filterServerDuplicates()
  }

  /** Returns false when the name/floor, duplicate identity or preview limit prevents adding. */
  function addRow(roomNumber: string, floor: number): boolean {
    const parsed = manualRoomSchema.safeParse({ room_number: roomNumber, floor })
    if (!parsed.success || Math.max(rows.value.length, manualRows.value.length) >= QUICK_ROOM_MAX) return false
    const number = parsed.data.room_number
    const key = roomKey(number)
    if ([...rows.value, ...manualRows.value].some(row => roomKey(row.roomNumber) === key)) return false
    const row: PreviewRoom = { roomNumber: number, floor, rent: defaultRent.value, area: defaultArea.value, overridden: [], existing: existingKeys.value.has(key), manual: true }
    manualRows.value.push(row)
    manualFloors.set(number, floor)
    regenerate()
    return true
  }

  const duplicateRoomNumbers = computed(() => {
    const seen = new Set<string>()
    const dups = new Set<string>()
    for (const row of rows.value) {
      const key = roomKey(row.roomNumber)
      if (seen.has(key)) dups.add(row.roomNumber)
      seen.add(key)
    }
    return [...dups]
  })

  function markServerDuplicates(roomNumbers: string[]) {
    serverDuplicates.value = roomNumbers
    filterServerDuplicates()
  }

  /** Throws a static Vietnamese message for an invalid preview; never truncates a payload. */
  function toPayload(): QuickRoomInput[] {
    if (!enabled.value) return []
    if (generatorError.value) throw new Error('Cấu hình sinh phòng không hợp lệ.')
    const included = rows.value.filter(row => !existingKeys.value.has(roomKey(row.roomNumber)))
    if (included.length > QUICK_ROOM_MAX) throw new Error(`Tối đa ${QUICK_ROOM_MAX} phòng mỗi lần.`)
    const seen = new Set<string>()
    return included.map((row) => {
      const key = roomKey(row.roomNumber)
      if (seen.has(key)) throw new Error('Mã phòng bị trùng.')
      seen.add(key)
      const result = quickRoomSchema.safeParse({ room_number: row.roomNumber, floor: row.floor, monthly_rent: row.rent, area: row.area })
      if (!result.success) throw new Error('Thông tin phòng không hợp lệ.')
      return result.data
    })
  }

  return {
    enabled, generator, generatorError, existingRoomNumbers, defaultRent, defaultArea, samePrice,
    rows, duplicateRoomNumbers, serverDuplicates,
    setCell, resetCell, removeRow, addRow, markServerDuplicates, toPayload,
  }
}
