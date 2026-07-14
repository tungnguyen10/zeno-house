import { AiRetentionService } from '../../../services/ai/retention'
import { resolveAiRuntimePolicy } from '../../../utils/ai-runtime'

export default defineEventHandler(async (event) => {
  const runtime = useRuntimeConfig(event)
  const policy = resolveAiRuntimePolicy(runtime)
  if (!policy.retentionCleanupEnabled) {
    return { data: { skipped: true, reason: 'disabled_by_config' } }
  }
  const secret = runtime.aiRetentionCleanupSecret as string
  if (!secret || getRequestHeader(event, 'x-ai-retention-secret') !== secret) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const result = await AiRetentionService.cleanup(event, policy.retentionCleanupBatchSize)
  return { data: { skipped: false, ...result } }
})
