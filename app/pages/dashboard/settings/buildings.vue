<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.can('buildings.visibility.manage')) return navigateTo('/dashboard')
  },
})

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Hiển thị toà nhà' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const toast = useToast()

const { data, status, error, refresh } = useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100, sort: 'name', order: 'asc', include_hidden: true } },
)

const buildings = computed(() => data.value?.data ?? [])
const isLoading = computed(() => status.value === 'pending')
const hiddenCount = computed(() => buildings.value.filter(building => building.isHidden).length)

// Toggled rows render optimistically; the map holds the pending target state so
// a failed request can fall back to whatever the server last confirmed.
const pending = ref<Record<string, boolean>>({})

function isVisible(building: Building): boolean {
  const override = pending.value[building.id]
  return override !== undefined ? !override : !building.isHidden
}

async function setVisible(building: Building, visible: boolean) {
  if (pending.value[building.id] !== undefined) return
  pending.value = { ...pending.value, [building.id]: !visible }

  try {
    await apiFetch(`/api/buildings/${building.id}/visibility`, {
      method: 'PATCH',
      body: { is_hidden: !visible },
    })
    // Every other screen scopes by visibility, so drop all cached payloads.
    clearNuxtData()
    await refresh()
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Không thể đổi hiển thị toà nhà.'))
  }
  finally {
    const { [building.id]: _removed, ...rest } = pending.value
    pending.value = rest
  }
}
</script>

<template>
  <div>
    <AppSettingsSubNav />

    <UiPageHeader
      title="Hiển thị toà nhà"
      description="Tắt một toà nhà để loại dữ liệu của nó khỏi danh sách và số liệu tổng hợp. Link trực tiếp tới hồ sơ cũ vẫn mở được."
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

    <UiAlert v-if="error" severity="danger" title="Không tải được danh sách toà nhà">
      {{ getApiErrorMessage(error, 'Hãy thử lại sau.') }}
    </UiAlert>

    <div v-else-if="isLoading" class="space-y-2">
      <UiSkeleton v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>

    <UiEmptyState
      v-else-if="buildings.length === 0"
      title="Chưa có toà nhà nào"
      description="Tạo toà nhà trước khi cấu hình hiển thị."
    />

    <UiFormSection
      v-else
      title="Toà nhà"
      :description="hiddenCount > 0
        ? `${hiddenCount} toà nhà đang ẩn khỏi danh sách và số liệu tổng hợp.`
        : 'Tất cả toà nhà đang hiển thị.'"
    >
      <ul class="-my-1 divide-y divide-ui-border">
        <li
          v-for="building in buildings"
          :key="building.id"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-sm font-medium text-ui-primary">{{ building.name }}</p>
              <UiBadge v-if="building.isHidden" variant="warning">Đang ẩn</UiBadge>
            </div>
            <p class="mt-0.5 truncate text-xs text-ui-muted">{{ building.address }}</p>
          </div>

          <UiToggle
            :model-value="isVisible(building)"
            :disabled="pending[building.id] !== undefined"
            :aria-label="`Hiển thị ${building.name}`"
            @update:model-value="setVisible(building, $event)"
          />
        </li>
      </ul>
    </UiFormSection>
  </div>
</template>
