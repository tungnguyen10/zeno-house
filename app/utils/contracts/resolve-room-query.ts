import { isUuid } from '~/utils/format/slug'

export async function resolveRoomQuery(
  value: unknown,
  fetchRoom: (code: string) => Promise<{ id: string } | null>,
): Promise<string> {
  if (typeof value !== 'string' || value.trim() === '') return ''
  if (isUuid(value)) return value
  try {
    return (await fetchRoom(value))?.id ?? ''
  }
  catch {
    return ''
  }
}
