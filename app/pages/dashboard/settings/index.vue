<script setup lang="ts">
import { getSettingsNavGroups } from '~/utils/constants/navigation'

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Cài đặt' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const authStore = useAuthStore()

// Desktop already shows the nav column, so open the first item instead of an empty pane.
onMounted(() => {
  if (!window.matchMedia('(min-width: 1024px)').matches) return
  const first = getSettingsNavGroups({ isAdmin: authStore.isAdmin, role: authStore.role })[0]?.items[0]
  if (first) void navigateTo(first.to, { replace: true })
})
</script>

<template>
  <div>
    <div class="lg:hidden">
      <UiPageHeader
        title="Cài đặt"
        description="Tài khoản của bạn và quản trị hệ thống."
        :reserve-global-actions="false"
      >
        <div ref="titleSentinel" aria-hidden="true" />
      </UiPageHeader>
      <AppSettingsNav variant="list" />
    </div>
    <UiSkeleton class="hidden h-64 w-full lg:block" />
  </div>
</template>
