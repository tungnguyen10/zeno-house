import { slugifyName } from '~/utils/format/slug'

/**
 * Generate a building code from its slug.
 * Takes the first character of each hyphen-separated word, lowercase.
 * Example: "zeno-house-phu-nhuan" → "zhpn"
 */
export function buildingCodeFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word[0] ?? '')
    .join('')
    .toLowerCase()
}

/**
 * Generate name initials from a full name.
 * Slugifies the name first to strip diacritics, then takes first char per word.
 * Example: "Nguyễn Văn A" → slugify → "nguyen-van-a" → "nva"
 */
export function nameInitialsFromFullName(fullName: string): string {
  const slug = slugifyName(fullName)
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word[0] ?? '')
    .join('')
    .toLowerCase()
}
