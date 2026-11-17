/** Residents currently living under a contract: the primary tenant plus roommates who have not moved out. */
export function countActiveResidents(occupants: { role: string; moveOutDate: string | null }[]): number {
  return occupants.filter(o => o.role === 'roommate' && !o.moveOutDate).length + 1
}
