/** Combobox label for a room; the building name keeps rooms with the same number apart. */
export function roomOptionLabel(roomNumber: string, buildingName: string | undefined): string {
  return buildingName ? `${buildingName} · ${roomNumber}` : roomNumber
}
