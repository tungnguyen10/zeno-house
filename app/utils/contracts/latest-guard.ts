/** Each call invalidates earlier ones; the returned check is true only for the newest call. */
export function createLatestGuard(): () => () => boolean {
  let latest = 0
  return () => {
    const mine = ++latest
    return () => mine === latest
  }
}
