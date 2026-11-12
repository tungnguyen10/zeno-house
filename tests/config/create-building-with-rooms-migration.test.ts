import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111090000_create_building_with_rooms.sql'), 'utf8')

describe('create_building_with_rooms migration', () => {
  it('defines both functions as security invoker with empty search_path', () => {
    expect(sql).toMatch(/function public\.create_rooms_batch\([\s\S]*?security invoker[\s\S]*?set search_path = ''/)
    expect(sql).toMatch(/function public\.create_building_with_rooms\([\s\S]*?security invoker[\s\S]*?set search_path = ''/)
  })

  it('restricts execution to service_role', () => {
    expect(sql).toContain('revoke all on function public.create_rooms_batch(uuid, jsonb) from public, anon, authenticated;')
    expect(sql).toContain('grant execute on function public.create_rooms_batch(uuid, jsonb) to service_role;')
    expect(sql).toContain('revoke all on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) from public, anon, authenticated;')
    expect(sql).toContain('grant execute on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) to service_role;')
  })

  it('uses namespaced idempotency key and actor check', () => {
    expect(sql).toContain(`'building.create:' || p_request_id::text`)
    expect(sql).toContain('v_op.actor_id is distinct from p_actor_id')
  })

  it('serializes per building and per request', () => {
    expect(sql).toContain(`pg_advisory_xact_lock(hashtextextended('rooms_batch:' || p_building_id::text, 0))`)
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(v_key, 0))')
  })
})
