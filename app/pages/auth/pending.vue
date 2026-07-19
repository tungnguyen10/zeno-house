<script setup lang="ts">
import type { CurrentAccessRequest } from '~/types/access-requests'
import { getRedirectByRole } from '~/utils/auth-redirect'

definePageMeta({ layout: 'auth', title: 'Chờ phê duyệt' })
const { refreshSession, logout } = useAuth()
const request = ref<CurrentAccessRequest | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

async function refresh() {
  try {
    const response = await $fetch<{ data: CurrentAccessRequest }>('/api/auth/access-request/me')
    request.value = response.data
    errorMessage.value = null
    if (response.data.status === 'approved') {
      const session = await refreshSession()
      const role = session?.user.app_metadata?.role as string | null | undefined
      await navigateTo(getRedirectByRole(role))
    }
  }
  catch { errorMessage.value = 'Không thể kiểm tra trạng thái. Hãy thử lại.' }
  finally { loading.value = false }
}

function onVisibilityChange() {
  if (!document.hidden) void refresh()
}

onMounted(() => {
  void refresh()
  timer = setInterval(() => { if (!document.hidden) void refresh() }, 15_000)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div>
    <div class="mb-7"><p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Trạng thái tài khoản</p><h2 class="mt-2 text-2xl font-semibold text-white">{{ request?.status === 'rejected' ? 'Yêu cầu chưa được chấp thuận' : 'Đang chờ admin phê duyệt' }}</h2><p class="mt-2 break-words text-sm leading-6 text-muted">{{ request?.email || 'Đang tải thông tin tài khoản…' }}</p></div>
    <div class="rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6">
      <UiSkeleton v-if="loading" class="h-24 w-full" />
      <UiAlert v-else-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <UiAlert v-else-if="request?.status === 'rejected'" severity="danger" title="Yêu cầu đã bị từ chối">{{ request.rejectionReason }}</UiAlert>
      <UiAlert v-else severity="info" title="Yêu cầu đã được ghi nhận">Trang này tự kiểm tra trạng thái. Bạn có thể đóng trang và đăng nhập lại sau.</UiAlert>
      <div class="mt-5 flex flex-col gap-2 sm:flex-row">
        <UiButton class="flex-1" variant="secondary" :loading="loading" @click="refresh"><IconRefresh v-if="!loading" class="size-4" aria-hidden="true" />Kiểm tra lại</UiButton>
        <UiButton class="flex-1" variant="ghost" @click="logout">Đăng xuất</UiButton>
      </div>
    </div>
  </div>
</template>
