import {
  BILLING_AUDIT_ACTION_CATEGORY,
  type BillingAuditAction,
  type BillingAuditCategory,
} from '~/utils/constants/billing'

export interface AuditCategoryVisual {
  category: BillingAuditCategory
  label: string
  /** Tailwind text color for the leading icon. */
  iconClass: string
  /** Tailwind background tint for the leading icon bubble. */
  bubbleClass: string
  /** Tailwind classes for filter chips / badges. */
  badgeClass: string
}

const VISUALS: Record<BillingAuditCategory, Omit<AuditCategoryVisual, 'category'>> = {
  create: {
    label: 'Tạo mới',
    iconClass: 'text-emerald-400',
    bubbleClass: 'bg-emerald-500/10',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  },
  edit: {
    label: 'Chỉnh sửa',
    iconClass: 'text-amber-400',
    bubbleClass: 'bg-amber-500/10',
    badgeClass: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  },
  destructive: {
    label: 'Phá huỷ',
    iconClass: 'text-rose-400',
    bubbleClass: 'bg-rose-500/10',
    badgeClass: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
  },
  status: {
    label: 'Trạng thái',
    iconClass: 'text-sky-400',
    bubbleClass: 'bg-sky-500/10',
    badgeClass: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  },
  other: {
    label: 'Khác',
    iconClass: 'text-slate-400',
    bubbleClass: 'bg-slate-500/10',
    badgeClass: 'bg-slate-500/10 text-slate-300 ring-slate-500/30',
  },
}

/** Map an action code to its audit category, defaulting to `other`. */
export function auditCategoryForAction(action: string): BillingAuditCategory {
  return BILLING_AUDIT_ACTION_CATEGORY[action as BillingAuditAction] ?? 'other'
}

/** Visual metadata (label + Tailwind tones) for a category. */
export function auditCategoryVisual(category: BillingAuditCategory): AuditCategoryVisual {
  return { category, ...VISUALS[category] }
}

/** Ordered list of all category visuals for filter chips. */
export const AUDIT_CATEGORY_VISUALS: AuditCategoryVisual[] = (
  Object.keys(VISUALS) as BillingAuditCategory[]
).map(auditCategoryVisual)
