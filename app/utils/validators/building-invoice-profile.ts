import { z } from 'zod'

export const INVOICE_PROFILE_TEMPLATE_VARIABLES = [
  'building_code',
  'room_number',
  'invoice_code',
  'period',
] as const

const supportedVariables = new Set<string>(INVOICE_PROFILE_TEMPLATE_VARIABLES)

export function extractTransferTemplateVariables(template: string): string[] {
  const variables: string[] = []
  for (const match of template.matchAll(/\{([^{}]+)\}/g)) {
    const variable = match[1]
    if (variable && !variables.includes(variable)) variables.push(variable)
  }
  return variables
}

export const buildingInvoiceProfileFieldsSchema = z.object({
  bank_name: z.string().trim().min(1, 'Vui lòng nhập tên ngân hàng').max(120),
  account_holder: z.string().trim().min(1, 'Vui lòng nhập tên chủ tài khoản').max(120),
  account_number: z.string().trim().min(1, 'Vui lòng nhập số tài khoản').max(50),
  transfer_content_template: z.string().trim().min(1, 'Vui lòng nhập nội dung chuyển khoản').max(200),
}).superRefine((value, ctx) => {
  const unsupported = extractTransferTemplateVariables(value.transfer_content_template)
    .filter(variable => !supportedVariables.has(variable))
  if (unsupported.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['transfer_content_template'],
      message: `Biến không được hỗ trợ: ${unsupported.map(variable => `{${variable}}`).join(', ')}`,
    })
  }
})

export type BuildingInvoiceProfileFieldsInput = z.infer<typeof buildingInvoiceProfileFieldsSchema>
