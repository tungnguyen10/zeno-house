<script setup lang="ts">
import { getMoreSheetSections } from '~/utils/constants/navigation'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const route = useRoute()
const authStore = useAuthStore()

const sections = computed(() => getMoreSheetSections({ isAdmin: authStore.isAdmin, role: authStore.role }))

function isActive(item: { to: string, activeMatch?: string }) {
  const to = item.activeMatch ?? item.to
  return route.path === to || route.path.startsWith(`${to}/`)
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <UiDrawer
    :model-value="props.modelValue"
    title="Thêm"
    width="w-full"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <nav aria-label="Điều hướng khác">
      <div v-for="(section, index) in sections" :key="section.key" :class="index > 0 && 'mt-4'">
        <p v-if="section.label" class="mb-1.5 px-1 text-[11px] font-semibold leading-4 text-ui-muted">
          {{ section.label }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.key">
            <NuxtLink
              :to="item.to"
              class="flex min-h-12 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-ui-primary transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40"
              :class="isActive(item) ? 'text-ui-accent' : undefined"
              :aria-current="isActive(item) ? 'page' : undefined"
              @click="close"
            >
              <component :is="item.icon" class="h-5 w-5 shrink-0 text-current" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>
  </UiDrawer>
</template>
