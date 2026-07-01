import { uuidv7 } from 'uuidv7'

/**
 * Generate a new correlation id for grouping related billing audit events
 * emitted by a single atomic operation (void+reissue, issue_and_pay,
 * bulk payment parent+children).
 *
 * Uses UUID v7 (time-ordered) so sorting by id approximates chronological
 * order, which makes correlation groups easy to inspect during debugging.
 */
export function newCorrelationId(): string {
  return uuidv7()
}
