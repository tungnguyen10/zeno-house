<script setup lang="ts">
import type { TenantSupportRequestStatus } from '~/types/tenant-portal'
import { PORTAL_STATUS_STYLES } from '~/utils/constants/portal-status'

const props = defineProps<{
  status: TenantSupportRequestStatus
}>()

const style = computed(() => PORTAL_STATUS_STYLES[props.status])
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
    :class="style.className"
  >
    {{ style.label }}
  </span>
</template>
