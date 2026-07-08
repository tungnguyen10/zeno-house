<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import clsx from 'clsx'
import type { ContractWithDetails } from '~/types/contracts'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  contract: ContractWithDetails
  paidAmount?: number
  canManage?: boolean
}>()

const emit = defineEmits<{
  edit: []
  renew: []
  terminate: []
  delete: []
}>()

function monthDiff(start: string, end = new Date()) {
  const from = new Date(start)
  return Math.max(0, (end.getFullYear() - from.getFullYear()) * 12 + end.getMonth() - from.getMonth() + 1)
}

const monthsElapsed = computed(() => monthDiff(props.contract.startDate))
const depositBalance = computed(() => Math.max(0, props.contract.deposit - (props.paidAmount ?? 0)))

const canRenew = computed(() => props.contract.status === 'active' || props.contract.status === 'expired')
const canTerminate = computed(() => props.contract.status === 'active')

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}
function closeMenu() {
  menuOpen.value = false
}
function emitAction(name: 'edit' | 'renew' | 'terminate' | 'delete') {
  closeMenu()
  if (name === 'edit') emit('edit')
  else if (name === 'renew') emit('renew')
  else if (name === 'terminate') emit('terminate')
  else emit('delete')
}

onClickOutside(menuRef, closeMenu, { ignore: [triggerRef] })
onKeyStroke('Escape', () => {
  if (menuOpen.value) closeMenu()
})
</script>

<template>
  <UiSurfacePanel as="section">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-xl font-semibold text-white">{{ contract.contractCode }}</h1>
          <UiStatusBadge :status="contract.status" />
        </div>
        <div class="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{{ contract.room.buildingName }}</span>
          <span aria-hidden="true">/</span>
          <NuxtLink :to="`/rooms/${contract.room.code}`" class="text-cyan hover:underline">
            Phòng {{ contract.room.roomNumber }}
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink :to="`/tenants/${contract.tenant.code}`" class="text-cyan hover:underline">
            {{ contract.tenant.fullName }}
          </NuxtLink>
        </div>
      </div>

      <div v-if="canManage" class="relative shrink-0">
        <UiButton
          ref="triggerRef"
          unstyled
          data-test="hero-actions-trigger"
          class="inline-flex items-center gap-1.5 rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-dark-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-border"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          @click="toggleMenu"
        >
          <span>Quản trị</span>
          <IconChevronDown
            :class="clsx('h-3 w-3 transition-transform duration-150', menuOpen && 'rotate-180')"
            aria-hidden="true"
          />
        </UiButton>

        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 -translate-y-1 scale-95"
        >
          <div
            v-if="menuOpen"
            ref="menuRef"
            role="menu"
            data-test="hero-actions-menu"
            class="absolute right-0 z-30 mt-2 w-52 origin-top-right overflow-hidden rounded-lg border border-dark-border bg-dark-card shadow-xl shadow-black/40"
          >
            <UiButton
              unstyled
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white transition-colors hover:bg-dark-hover focus-visible:bg-dark-hover focus-visible:outline-none"
              @click="emitAction('edit')"
            >
              Chỉnh sửa
            </UiButton>
            <UiButton
              v-if="canRenew"
              unstyled
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white transition-colors hover:bg-dark-hover focus-visible:bg-dark-hover focus-visible:outline-none"
              @click="emitAction('renew')"
            >
              Gia hạn
            </UiButton>
            <UiButton
              v-if="canTerminate"
              unstyled
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white transition-colors hover:bg-dark-hover focus-visible:bg-dark-hover focus-visible:outline-none"
              @click="emitAction('terminate')"
            >
              Kết thúc sớm
            </UiButton>
            <template v-if="canManage">
              <div class="h-px bg-dark-border" aria-hidden="true" />
              <UiButton
                unstyled
                role="menuitem"
                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-error transition-colors hover:bg-error/10 focus-visible:bg-error/10 focus-visible:outline-none"
                @click="emitAction('delete')"
              >
                Xoá hợp đồng
              </UiButton>
            </template>
          </div>
        </Transition>
      </div>
    </div>

    <dl class="mt-4 grid grid-cols-1 divide-y divide-dark-border overflow-hidden rounded-lg border border-dark-border bg-dark-deep/30 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
      <div class="px-4 py-2.5">
        <dt class="text-xs text-muted">Khách thuê</dt>
        <dd class="mt-0.5 truncate text-sm font-medium text-white">
          <NuxtLink :to="`/tenants/${contract.tenant.code}`" class="hover:text-cyan">{{ contract.tenant.fullName }}</NuxtLink>
        </dd>
      </div>
      <div class="px-4 py-2.5">
        <dt class="text-xs text-muted">Phòng</dt>
        <dd class="mt-0.5 truncate text-sm font-medium text-white">
          <NuxtLink :to="`/rooms/${contract.room.code}`" class="hover:text-cyan">
            {{ contract.room.buildingName }} - {{ contract.room.roomNumber }}
          </NuxtLink>
        </dd>
      </div>
      <div class="px-4 py-2.5">
        <dt class="text-xs text-muted">Đã đi qua</dt>
        <dd class="mt-0.5 text-base font-semibold text-white">{{ monthsElapsed }} tháng</dd>
      </div>
      <div class="px-4 py-2.5">
        <dt class="text-xs text-muted">Đã thu / còn cọc</dt>
        <dd class="mt-0.5 text-sm font-semibold text-white">
          {{ formatCurrency(paidAmount ?? 0) }}
          <span class="text-muted">/ {{ formatCurrency(depositBalance) }}</span>
        </dd>
      </div>
    </dl>
  </UiSurfacePanel>
</template>
