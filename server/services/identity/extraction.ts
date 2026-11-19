import type { H3Event } from 'h3'
import { setResponseHeader } from 'h3'
import type { AuthUser } from '~/types/auth'
import { IDENTITY_PURPOSE_CAPABILITIES, identityExtractionSchema, type IdentityPurpose } from '~/utils/validators/identity-extraction'
import { IdentityOcrUsageRepository } from '../../repositories/identity-ocr-usage'
import { extractIdentityWithClaude, VisionProviderError } from '../ai/anthropic-vision'
import { validateIdentityImages } from '../../utils/identity-images'
import { getTenantVisionRuntime } from '../../utils/tenant-vision-runtime'
import { normalizeExtraction, type IdentitySuggestion } from './normalize'

// Single-instance guard; the daily quota stays the authoritative limit.
const inFlightUsers = new Set<string>()

function fail(status: number, code: string, message: string): never {
  throw createError({ statusCode: status, data: { error: { code, message } } })
}

function costMicroUsd(
  usage: { inputTokens: number, outputTokens: number },
  prices: { input: number, output: number },
): number {
  return Math.ceil((usage.inputTokens * prices.input) / 1e6 + (usage.outputTokens * prices.output) / 1e6)
}

const IMAGE_ERRORS: Record<number, { code: string, message: string }> = {
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Ảnh quá lớn (tối đa 5 MB mỗi ảnh).' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.' },
  422: { code: 'VALIDATION_ERROR', message: 'Cần 1 hoặc 2 ảnh hợp lệ, không bị hỏng.' },
}

export const IdentityExtractionService = {
  async extract(
    event: H3Event,
    user: AuthUser,
    purpose: IdentityPurpose,
    parts: { data: Buffer, filename?: string, type?: string }[],
  ): Promise<{ suggestion: IdentitySuggestion, model: string }> {
    if (!IDENTITY_PURPOSE_CAPABILITIES[purpose].some(capability => can(user, capability))) {
      throwForbidden('Không có quyền đọc ảnh giấy tờ')
    }

    const runtime = getTenantVisionRuntime(event)
    if (!runtime.enabled) {
      fail(503, 'IDENTITY_VISION_DISABLED', 'Tính năng đọc ảnh giấy tờ chưa được bật. Vui lòng nhập tay.')
    }

    if (inFlightUsers.has(user.id)) {
      fail(429, 'IDENTITY_VISION_BUSY', 'Đang xử lý ảnh trước đó. Vui lòng chờ.')
    }
    inFlightUsers.add(user.id)

    try {
      const validation = validateIdentityImages(parts)
      if (!validation.ok) {
        const error = IMAGE_ERRORS[validation.status]!
        fail(validation.status, error.code, error.message)
      }

      const reservation = await IdentityOcrUsageRepository.reserve(event, user.id, {
        globalLimit: runtime.dailyLimit,
        userLimit: runtime.userDailyLimit,
        budgetMicroUsd: runtime.dailyBudgetMicroUsd,
        reserveMicroUsd: runtime.reserveMicroUsd,
      })
      if (reservation.kind === 'quota') {
        if (reservation.reason === 'budget') {
          fail(503, 'IDENTITY_OCR_BUDGET', 'Đã hết ngân sách đọc ảnh hôm nay. Vui lòng nhập tay.')
        }
        fail(429, 'IDENTITY_OCR_QUOTA', 'Đã hết lượt đọc ảnh hôm nay. Vui lòng nhập tay.')
      }

      const release = async () => {
        await IdentityOcrUsageRepository.release(event, reservation.id).catch(() => {
          console.error('[identity-ocr] release failed')
        })
      }

      let result: Awaited<ReturnType<typeof extractIdentityWithClaude>>
      try {
        result = await extractIdentityWithClaude({
          apiKey: runtime.apiKey,
          workspaceId: runtime.workspaceId,
          model: runtime.model,
          timeoutMs: runtime.timeoutMs,
          images: validation.images,
        })
      }
      catch (error) {
        await release()
        if (error instanceof VisionProviderError) {
          if (error.kind === 'timeout') fail(504, 'IDENTITY_VISION_TIMEOUT', 'Đọc ảnh quá lâu. Vui lòng thử lại hoặc nhập tay.')
          if (error.kind === 'invalid_output') fail(502, 'IDENTITY_VISION_INVALID_OUTPUT', 'Không đọc được kết quả từ ảnh. Vui lòng nhập tay.')
          if (error.kind === 'rate_limited' && error.retryAfterSeconds) {
            setResponseHeader(event, 'Retry-After', error.retryAfterSeconds)
          }
        }
        fail(503, 'IDENTITY_VISION_UNAVAILABLE', 'Dịch vụ đọc ảnh tạm thời không khả dụng. Vui lòng nhập tay.')
      }

      const parsed = identityExtractionSchema.safeParse(result.output)
      if (!parsed.success) {
        await release()
        fail(502, 'IDENTITY_VISION_INVALID_OUTPUT', 'Không đọc được kết quả từ ảnh. Vui lòng nhập tay.')
      }

      await IdentityOcrUsageRepository.settle(event, reservation.id, {
        costMicroUsd: costMicroUsd(result.usage, {
          input: runtime.inputPricePerMTokMicroUsd,
          output: runtime.outputPricePerMTokMicroUsd,
        }),
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        model: result.model,
      }).catch(() => {
        console.error('[identity-ocr] settle failed')
      })

      return { suggestion: normalizeExtraction(parsed.data), model: result.model }
    }
    finally {
      inFlightUsers.delete(user.id)
    }
  },
}
