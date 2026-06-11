<script setup lang="ts">
const props = defineProps<{
  title?: string
}>()

const emit = defineEmits<{
  (e: 'toggleSidebar'): void
}>()

const route = useRoute()
const { logout } = useAuth()
const authStore = useAuthStore()

// Use route meta title if available, fallback to prop, then empty string
const pageTitle = computed(() =>
  props.title ?? (route.meta.title as string | undefined) ?? '',
)

const userInitial = computed(() => {
  const email = authStore.user?.email ?? ''
  return email.charAt(0).toUpperCase() || 'U'
})
</script>

<template>
  <header class="flex h-16 shrink-0 items-center gap-4 border-b border-dark-border bg-dark-card px-4 sm:px-6">
    <!-- Hamburger button — mobile only -->
    <UiButton
      variant="ghost"
      icon-only
      class="lg:hidden"
      aria-label="Mở sidebar"
      @click="emit('toggleSidebar')"
    >
      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
      </svg>
    </UiButton>

    <!-- Page title -->
    <div class="flex-1 min-w-0">
      <h1 class="text-base font-semibold text-white truncate">
        {{ pageTitle }}
      </h1>
    </div>

    <!-- Right actions — user info + logout -->
    <div class="flex items-center gap-3">
      <span class="hidden text-sm text-muted sm:block truncate max-w-[160px]">
        {{ authStore.user?.email }}
      </span>
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-cyan/20" aria-hidden="true">
        <span class="text-xs font-semibold text-cyan">{{ userInitial }}</span>
      </div>
      <UiButton
        variant="ghost"
        icon-only
        aria-label="Đăng xuất"
        title="Đăng xuất"
        @click="logout"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clip-rule="evenodd" />
          <path fill-rule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-1.047a.75.75 0 1 1 1.06-1.06l2.35 2.347a.75.75 0 0 1 0 1.06l-2.35 2.348a.75.75 0 1 1-1.06-1.06l1.047-1.048H6.75A.75.75 0 0 1 6 10Z" clip-rule="evenodd" />
        </svg>
      </UiButton>
    </div>
  </header>
</template>
