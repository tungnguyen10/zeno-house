<script setup lang="ts">
import { resolveStatus, type StatusContext } from '~/utils/constants/statuses'

const props = defineProps<{
  status: string
  /**
   * Disambiguates keys that appear in multiple status maps (e.g. `draft`, `issued`
   * exist for both billing period and invoice). Omit for entity defaults.
   */
  context?: StatusContext
}>()

const config = computed(() => resolveStatus(props.status, props.context))
</script>

<template>
  <UiBadge :variant="config.variant" pill>{{ config.label }}</UiBadge>
</template>
