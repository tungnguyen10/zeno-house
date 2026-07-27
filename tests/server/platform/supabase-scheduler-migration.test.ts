import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = resolve(
  root,
  'supabase/migrations/20260727103000_migrate_nitro_schedulers_to_supabase_cron.sql',
)
const verificationPath = resolve(root, 'supabase/verification/nitro_schedulers_pg_cron.sql')

function migrationSql(): string {
  return readFileSync(migrationPath, 'utf8').toLowerCase()
}

describe('Supabase scheduler migration', () => {
  it('creates the required pg_cron and pg_net schedules without embedding credentials', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = migrationSql()

    expect(sql).toContain('create extension if not exists pg_cron')
    expect(sql).toContain('create extension if not exists pg_net')
    expect(sql).toContain("'invoice-email-dispatch-every-minute'")
    expect(sql).toContain("'* * * * *'")
    expect(sql).toContain("'operations-report-auto-close'")
    expect(sql).toContain("'55 16 * * *'")
    expect(sql).toContain("'ai-retention-cleanup'")
    expect(sql).toContain("'20 17 * * *'")
    expect(sql).toContain("'nitro_scheduler_base_url'")
    expect(sql).toContain("'invoice_email_dispatch_secret'")
    expect(sql).toContain("'operations_report_auto_close_secret'")
    expect(sql).toContain("'ai_retention_cleanup_secret'")
    expect(sql).toContain('vault.decrypted_secrets')
    expect(sql).toContain('net.http_post')
    expect(sql).not.toMatch(/https:\/\//)
    expect(sql).not.toMatch(/[a-f0-9]{64}/)
  })

  it('calls the existing secret-protected Nitro endpoints with their expected headers', () => {
    const sql = migrationSql()

    expect(sql).toContain("'/api/internal/invoice-email/dispatch'")
    expect(sql).toContain("'x-invoice-email-dispatch-secret'")
    expect(sql).toContain("'/api/internal/operations-report/auto-close'")
    expect(sql).toContain("'x-operations-report-cron-secret'")
    expect(sql).toContain("'/api/internal/ai/retention-cleanup'")
    expect(sql).toContain("'x-ai-retention-secret'")
    expect(sql).not.toContain('insert into cron.job')
    expect(sql).not.toContain('update cron.job')
  })

  it('ships SQL Editor verification for schedules and run history', () => {
    expect(existsSync(verificationPath)).toBe(true)
    const verification = readFileSync(verificationPath, 'utf8').toLowerCase()

    expect(verification).toContain('cron.job')
    expect(verification).toContain('cron.job_run_details')
    expect(verification).toContain('invoice-email-dispatch-every-minute')
    expect(verification).toContain('operations-report-auto-close')
    expect(verification).toContain('ai-retention-cleanup')
  })

  it('does not leave Nitro scheduled tasks configured for Vercel Cron', () => {
    const config = readFileSync(resolve(root, 'nuxt.config.ts'), 'utf8')

    expect(config).not.toContain('scheduledTasks')
    expect(config).not.toContain('invoice-email:dispatch')
    expect(config).not.toContain('operations-report:auto-close')
    expect(config).not.toContain('ai:retention-cleanup')
  })
})
