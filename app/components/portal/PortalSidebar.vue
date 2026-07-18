<script setup lang="ts">
import { PORTAL_NAV_ITEMS, type PortalNavItem, isPortalNavActive } from '~/utils/constants/portal-nav'

const items = PORTAL_NAV_ITEMS

const route = useRoute()
const { profile } = usePortalProfile()
const { contract } = usePortalContract()

function isActive(item: PortalNavItem): boolean {
  return isPortalNavActive(item, route.path)
}

/** Two-letter initials from the tenant's name for the identity chip. */
const initials = computed(() => {
  const name = profile.value?.fullName?.trim()
  if (!name) return 'ZH'
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
})
</script>

<template>
  <aside
    class="portal-safe-top portal-safe-x hidden w-64 shrink-0 flex-col border-r border-border-light bg-white lg:flex"
    aria-label="Điều hướng chính"
  >
    <NuxtLink
      to="/portal"
      class="flex h-16 items-center px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40"
    >
      <IconLogo class="h-7 w-auto text-title" aria-label="Zeno House" />
    </NuxtLink>

    <nav class="flex-1 space-y-1 px-3 py-4">
      <NuxtLink
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        class="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40"
        :class="isActive(item)
          ? 'bg-smoke-blue text-theme'
          : 'text-body hover:bg-smoke hover:text-title'"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <span class="flex h-5 w-5 shrink-0 items-center justify-center">
          <component :is="item.icon" class="h-5 w-5" aria-hidden="true" />
        </span>
        <span class="portal-type-label text-sm font-medium normal-case tracking-normal">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <NuxtLink
      to="/portal/profile"
      class="mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-border-light p-2.5 transition-colors hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40"
    >
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-smoke-blue portal-type-label text-sm font-semibold normal-case tracking-normal text-theme">
        {{ initials }}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate portal-type-label text-sm font-semibold normal-case tracking-normal text-title">
          {{ profile?.fullName ?? 'Người thuê' }}
        </span>
        <span class="block truncate portal-type-caption text-body">
          {{ contract?.buildingName ?? 'Zeno House' }}
        </span>
      </span>
      <IconChevronRight class="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
    </NuxtLink>
  </aside>
</template>
