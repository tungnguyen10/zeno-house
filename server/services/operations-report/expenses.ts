import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense } from '~/types/operations-report'
import type {
  BuildingExpenseCreateInput,
  BuildingExpenseListQuery,
  BuildingExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import {
  BuildingExpenseRepository,
  type BuildingExpenseListFilter,
} from '../../repositories/operations-report/expenses'
import { AuditService } from '../audit'
import { ReserveFundService } from './reserve-funds'
import { db } from '../../utils/db'
import { assertBuildingScope } from '../../utils/scope'

const RECEIPT_BUCKET = 'expense-receipts'
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
const RECEIPT_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function requireBuilding(event: H3Event, buildingId: string) {
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

async function signedReceiptUrl(event: H3Event, path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await db(event)
    .storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 5)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data.signedUrl
}

async function withSignedReceipt(event: H3Event, expense: BuildingExpense): Promise<BuildingExpense> {
  return {
    ...expense,
    receiptSignedUrl: await signedReceiptUrl(event, expense.receiptUrl),
  }
}

export const BuildingExpenseService = {
  async list(
    event: H3Event,
    user: AuthUser,
    query: BuildingExpenseListQuery,
  ): Promise<BuildingExpense[]> {
    if (!can(user, 'building-expenses.read')) throwForbidden('Không có quyền xem chi phí')
    await requireBuilding(event, query.building_id)
    await assertBuildingScope(event, user, query.building_id, 'read')
    const filter: BuildingExpenseListFilter = {
      buildingId: query.building_id,
      periodYear: query.period_year,
      periodMonth: query.period_month,
      category: query.category,
    }
    const expenses = await BuildingExpenseRepository.list(event, filter)
    return Promise.all(expenses.map(expense => withSignedReceipt(event, expense)))
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: BuildingExpenseCreateInput,
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền thêm chi phí')
    await requireBuilding(event, input.building_id)
    await assertBuildingScope(event, user, input.building_id, 'write')

    const created = input.funded_by === 'reserve_fund'
      ? await ReserveFundService.createReserveFundedExpense(event, user, input)
      : await BuildingExpenseRepository.insert(event, input, user.id)

    await AuditService.append(event, user, {
      building_id: created.buildingId,
      action: AUDIT_ACTIONS.BUILDING_EXPENSE_CREATED,
      entity_type: 'building_expense',
      entity_id: created.id,
      after_data: created,
    })

    return withSignedReceipt(event, created)
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: BuildingExpenseUpdateInput,
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền sửa chi phí')
    const existing = await BuildingExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy khoản chi')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (existing.voidedAt) throwConflict('Khoản chi đã bị hủy, không thể sửa')

    const updated = await BuildingExpenseRepository.updateById(event, id, input)

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.BUILDING_EXPENSE_UPDATED,
      entity_type: 'building_expense',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return withSignedReceipt(event, updated)
  },

  async void(
    event: H3Event,
    user: AuthUser,
    id: string,
    voidReason: string,
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.delete')) throwForbidden('Không có quyền hủy chi phí')
    const existing = await BuildingExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy khoản chi')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (existing.voidedAt) throwConflict('Khoản chi đã bị hủy')

    const voided = await BuildingExpenseRepository.voidById(event, id, user.id, voidReason)
    await ReserveFundService.reverseExpenseWithdrawal(event, user, voided)

    await AuditService.append(event, user, {
      building_id: voided.buildingId,
      action: AUDIT_ACTIONS.BUILDING_EXPENSE_VOIDED,
      entity_type: 'building_expense',
      entity_id: voided.id,
      before_data: existing,
      after_data: voided,
      metadata: { void_reason: voidReason },
    })

    return withSignedReceipt(event, voided)
  },

  async uploadReceipt(
    event: H3Event,
    user: AuthUser,
    id: string,
    file: { filename?: string, type?: string, data: Buffer },
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền tải biên lai')
    const existing = await BuildingExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy khoản chi')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (existing.voidedAt) throwConflict('Khoản chi đã bị hủy')

    const contentType = file.type ?? ''
    const ext = RECEIPT_EXTENSIONS[contentType]
    if (!ext) throwValidationError('Biên lai phải là ảnh jpeg, png hoặc webp')
    if (file.data.length > MAX_RECEIPT_BYTES) throwValidationError('Biên lai không được vượt quá 5MB')

    const path = `${existing.buildingId}/${id}/${randomUUID()}.${ext}`
    const storage = db(event).storage.from(RECEIPT_BUCKET)
    const { error: uploadError } = await storage.upload(path, file.data, {
      contentType,
      upsert: false,
    })
    if (uploadError) throw createError({ statusCode: 500, message: uploadError.message })

    const updated = await BuildingExpenseRepository.updateReceiptPath(event, id, path)
    if (existing.receiptUrl) await storage.remove([existing.receiptUrl])

    return withSignedReceipt(event, updated)
  },

  async removeReceipt(event: H3Event, user: AuthUser, id: string): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền xóa biên lai')
    const existing = await BuildingExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy khoản chi')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (existing.voidedAt) throwConflict('Khoản chi đã bị hủy')

    const updated = await BuildingExpenseRepository.updateReceiptPath(event, id, null)
    if (existing.receiptUrl) {
      await db(event).storage.from(RECEIPT_BUCKET).remove([existing.receiptUrl])
    }

    return withSignedReceipt(event, updated)
  },
}
