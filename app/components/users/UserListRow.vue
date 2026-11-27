<script setup lang="ts">
import type { ManagedUserWithAssignments } from '~/types/users'
import { managedRoleLabel, userInitials } from '~/utils/users/display'

const props = defineProps<{
  row: ManagedUserWithAssignments
  manageable: boolean
}>()

const emit = defineEmits<{
  (e: 'open', userId: string): void
}>()

const displayName = computed(() => props.row.user.name ?? props.row.user.email ?? props.row.user.id)
const secondary = computed(() => (props.row.user.name ? props.row.user.email : null))
const initials = computed(() => userInitials(props.row.user.name, props.row.user.email))
</script>

<template>
  <component
    :is="manageable ? 'button' : 'div'"
    :type="manageable ? 'button' : undefined"
    class="flex w-full items-center gap-3 px-4 py-3 text-left"
    :class="manageable && 'transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40'"
    @click="manageable && emit('open', row.user.id)"
  >
    <span
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-accent/15 text-xs font-semibold text-ui-accent"
      aria-hidden="true"
    >
      {{ initials }}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-ui-primary">{{ displayName }}</span>
      <span v-if="secondary" class="block truncate text-xs text-ui-muted">{{ secondary }}</span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
      <UiBadge :variant="row.user.role === 'owner' ? 'accent' : 'neutral'">{{ managedRoleLabel(row.user.role) }}</UiBadge>
      <UiBadge v-if="row.assignments.length === 0" variant="warning">Chưa có tòa</UiBadge>
      <span v-else class="text-xs tabular-nums text-ui-muted">{{ row.assignments.length }} tòa</span>
    </span>
    <IconChevronRight v-if="manageable" class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
  </component>
</template>
