<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import { getApiErrorMessage } from '~/utils/api-error'
import { buildingSettingsPath } from '~/utils/routes/operational'

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Cài đặt tòa nhà' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const { data, status, error, refresh } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { limit: 100, sort: 'name', order: 'asc' },
})
const buildings = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <UiPageHeader
      title="Cài đặt tòa nhà"
      description="Hợp đồng, dịch vụ, hoá đơn và quy tắc tài chính của từng tòa."
      back-to="/dashboard/settings"
      back-mobile-only
      :reserve-global-actions="false"
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

    <UiAlert v-if="error" severity="danger" title="Không tải được danh sách tòa nhà">
      <p>{{ getApiErrorMessage(error, 'Hãy thử lại sau.') }}</p>
      <UiButton class="mt-2" size="sm" variant="secondary" @click="refresh()">Thử lại</UiButton>
    </UiAlert>

    <div v-else-if="status === 'pending'" class="space-y-2">
      <UiSkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
    </div>

    <UiEmptyState v-else-if="buildings.length === 0" title="Chưa có tòa nhà nào trong phạm vi của bạn" />

    <ul
      v-else
      role="list"
      class="-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:rounded-lg sm:border"
    >
      <li v-for="building in buildings" :key="building.id">
        <NuxtLink
          :to="buildingSettingsPath(building)"
          class="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ui-primary">{{ building.name }}</p>
            <p v-if="building.address" class="truncate text-xs text-ui-muted">{{ building.address }}</p>
          </div>
          <span class="hidden text-xs text-ui-muted sm:inline">Mở cài đặt</span>
          <IconChevronRight class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
