export default defineEventHandler(async (event) => {
  await requireAuth(event)
  throw createError({
    statusCode: 410,
    statusMessage: 'Manual reserve fund withdrawals are no longer supported',
  })
})
