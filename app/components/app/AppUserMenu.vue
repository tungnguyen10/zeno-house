<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import clsx from 'clsx'

const { logout } = useAuth()
const authStore = useAuthStore()

const isOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

const userInitial = computed(() => {
  const email = authStore.user?.email ?? ''
  return email.charAt(0).toUpperCase() || 'U'
})

const roleLabel = computed(() => {
  const r = authStore.role
  const map: Record<string, string> = { admin: 'Admin', manager: 'Manager', tenant: 'Tenant' }
  return r ? (map[r] ?? r) : 'User'
})

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

async function handleLogout() {
  close()
  await logout()
}

onClickOutside(menuRef, close, { ignore: [triggerRef] })
onKeyStroke('Escape', () => {
  if (isOpen.value) close()
})
</script>

<template>
  <div class="relative">
    <button
      ref="triggerRef"
      type="button"
      class="flex items-center gap-2 rounded-full border border-dark-border bg-dark-surface/60 py-1 pl-1 pr-2 transition-colors hover:bg-dark-hover hover:border-cyan/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      aria-label="Tài khoản"
      @click="toggle"
    >
      <span
        class="flex h-7 w-7 items-center justify-center rounded-full bg-cyan/20 text-xs font-semibold text-cyan"
        aria-hidden="true"
      >
        {{ userInitial }}
      </span>
      <IconChevronDown
        :class="clsx('h-3.5 w-3.5 text-muted transition-transform duration-150', isOpen && 'rotate-180')"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        role="menu"
        class="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-dark-border bg-dark-card shadow-xl shadow-black/40"
      >
        <div class="flex items-center gap-3 border-b border-dark-border px-4 py-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan/20 text-sm font-semibold text-cyan"
            aria-hidden="true"
          >
            {{ userInitial }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">
              {{ authStore.user?.email }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ roleLabel }}
            </p>
          </div>
        </div>

        <div class="py-1">
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2 text-sm text-muted transition-colors hover:bg-error/10 hover:text-error focus-visible:bg-error/10 focus-visible:text-error focus-visible:outline-none"
            @click="handleLogout"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                clip-rule="evenodd"
              />
              <path
                fill-rule="evenodd"
                d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-1.047a.75.75 0 1 1 1.06-1.06l2.35 2.347a.75.75 0 0 1 0 1.06l-2.35 2.348a.75.75 0 1 1-1.06-1.06l1.047-1.048H6.75A.75.75 0 0 1 6 10Z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
