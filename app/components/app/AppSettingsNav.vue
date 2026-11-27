<script setup lang="ts">
import clsx from 'clsx'
import { getSettingsNavGroups } from '~/utils/constants/navigation'

const props = withDefaults(defineProps<{
  variant?: 'sidebar' | 'list'
}>(), {
  variant: 'sidebar',
})

const route = useRoute()
const authStore = useAuthStore()

const groups = computed(() => getSettingsNavGroups({ isAdmin: authStore.isAdmin, role: authStore.role }))

const pendingCount = useAccessRequestPendingCount(() => authStore.isAdmin)
const pendingBadge = computed(() => {
  const count = pendingCount.value
  if (!count || count < 1) return null
  return { text: count > 99 ? '99+' : String(count), label: `${count} yêu cầu đang chờ duyệt` }
})

function isActive(to: string) {
  return props.variant === 'sidebar' && (route.path === to || route.path.startsWith(`${to}/`))
}

function listClass() {
  return props.variant === 'list'
    ? '-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:rounded-lg sm:border'
    : 'space-y-0.5'
}

function linkClass(to: string) {
  const base = 'relative flex items-center gap-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40'
  if (props.variant === 'list') {
    return clsx(base, 'min-h-12 px-4 text-ui-primary hover:bg-ui-hover active:bg-ui-hover')
  }
  return clsx(
    base,
    'min-h-9 rounded-md px-3 py-1.5',
    isActive(to)
      ? 'bg-ui-surface font-medium text-ui-primary'
      : 'text-ui-muted hover:bg-ui-hover hover:text-ui-primary',
  )
}
</script>

<template>
  <nav aria-label="Cài đặt" class="space-y-5">
    <div v-for="group in groups" :key="group.key" :data-settings-group="group.key">
      <p
        :id="`settings-group-${group.key}`"
        class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-ui-muted"
        :class="variant === 'list' && 'px-0'"
      >
        {{ group.label }}
      </p>
      <ul role="list" :aria-labelledby="`settings-group-${group.key}`" :class="listClass()">
        <li v-for="item in group.items" :key="item.key">
          <NuxtLink
            :to="item.to"
            :class="linkClass(item.to)"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <span
              v-if="isActive(item.to)"
              class="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-ui-accent"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="item.key === 'access-requests' && pendingBadge"
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-status-warning/15 px-1.5 text-xs font-semibold tabular-nums text-status-warning"
            >
              <span aria-hidden="true">{{ pendingBadge.text }}</span>
              <span class="sr-only">{{ pendingBadge.label }}</span>
            </span>
            <IconChevronRight v-if="variant === 'list'" class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
