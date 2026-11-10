export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  throwForbidden('Ảnh định danh do ban quản lý xác minh. Vui lòng gửi yêu cầu chỉnh sửa.')
})
