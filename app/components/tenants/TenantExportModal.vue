<script setup lang="ts">
import { useTenantExport } from '~/composables/tenants/useTenantExport'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; done: [] }>()
const state = useTenantExport()

watch(() => props.open, (open) => {
  if (open) void state.loadBuildings()
  else state.reset()
}, { immediate: true })

function close() {
  if (state.exporting.value) return
  state.reset()
  emit('close')
}

async function exportFile() {
  if (await state.exportSelected()) {
    emit('done')
    close()
  }
}
</script>

<template>
  <UiModal :open="open" title="Xuất danh sách khách thuê" size="lg" mobile-fullscreen @close="close">
    <div class="flex min-h-0 flex-col gap-4">
      <p class="text-sm text-ui-muted">Chọn tòa nhà và những khách đang ở cần đưa vào file Excel.</p>
      <UiAlert v-if="state.error.value" severity="danger" role="alert">{{ state.error.value }}</UiAlert>
      <div v-if="state.loadingBuildings.value" class="space-y-2" aria-label="Đang tải tòa nhà">
        <UiSkeleton class="h-10 w-full" />
      </div>
      <UiButton v-else-if="state.error.value && !state.buildingOptions.value.length" variant="secondary" size="sm" @click="state.loadBuildings()">Thử tải tòa nhà</UiButton>
      <UiSelect
        v-else
        :model-value="state.buildingId.value"
        :options="state.buildingOptions.value"
        label="Tòa nhà"
        placeholder="Chọn tòa nhà"
        required
        :disabled="state.exporting.value"
        @update:model-value="state.changeBuilding(String($event ?? ''))"
      />

      <template v-if="state.buildingId.value">
        <UiSearchInput
          v-model="state.search.value"
          placeholder="Tìm theo tên, mã, số điện thoại hoặc phòng…"
          aria-label="Tìm khách để xuất"
          density="normal"
          :disabled="state.loadingCandidates.value || state.exporting.value"
        />

        <div v-if="state.loadingCandidates.value" class="space-y-2" aria-label="Đang tải khách thuê">
          <UiSkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
        </div>
        <div v-else-if="state.error.value && !state.candidates.value.length" class="rounded-lg border border-ui-border bg-ui-surface px-4 py-6 text-center">
          <UiButton variant="secondary" size="sm" @click="state.changeBuilding(state.buildingId.value)">Thử tải lại</UiButton>
        </div>
        <div v-else-if="!state.candidates.value.length" class="rounded-lg border border-ui-border bg-ui-surface px-4 py-8 text-center text-sm text-ui-muted">
          Chưa có khách đang ở tòa nhà này.
        </div>
        <div v-else class="min-h-0 overflow-hidden rounded-lg border border-ui-border">
          <div class="flex items-center justify-between gap-3 border-b border-ui-border bg-ui-surface px-3 py-2">
            <UiCheckbox
              :model-value="state.allFilteredSelected.value"
              :indeterminate="state.filteredCandidates.value.some(row => state.selectedIds.value.includes(row.id)) && !state.allFilteredSelected.value"
              :disabled="!state.filteredCandidates.value.length || state.exporting.value"
              :label="`${state.allFilteredSelected.value ? 'Bỏ chọn' : 'Chọn'} tất cả kết quả (${state.filteredCandidates.value.length})`"
              @update:model-value="state.toggleAllFiltered()"
            />
            <span class="shrink-0 text-xs tabular-nums text-ui-muted">{{ state.selectedIds.value.length }} đã chọn</span>
          </div>
          <div v-if="!state.filteredCandidates.value.length" class="px-4 py-7 text-center text-sm text-ui-muted">
            Không tìm thấy khách phù hợp.
          </div>
          <ul v-else class="max-h-[min(46dvh,24rem)] divide-y divide-ui-border overflow-y-auto" aria-label="Khách đang ở tòa nhà">
            <li v-for="candidate in state.filteredCandidates.value" :key="candidate.id" class="flex items-center gap-3 px-3 py-2.5 hover:bg-ui-hover">
              <UiCheckbox
                :model-value="state.selectedIds.value.includes(candidate.id)"
                :aria-label="`Chọn ${candidate.fullName}`"
                :disabled="state.exporting.value"
                @update:model-value="state.toggleSelected(candidate.id)"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ui-primary">{{ candidate.fullName }}</p>
                <p class="truncate text-xs text-ui-muted">{{ candidate.code }} · Phòng {{ candidate.roomNumbers.join(', ') }} · {{ candidate.roles.includes('primary') ? 'Đứng tên' : 'Ở cùng' }} · {{ candidate.phone }}</p>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>
    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <span class="text-xs text-ui-muted">{{ state.selectedIds.value.length }} khách sẽ có trong file</span>
        <div class="flex gap-2">
          <UiButton variant="secondary" :disabled="state.exporting.value" @click="close">Hủy</UiButton>
          <UiButton data-test="export" :disabled="!state.buildingId.value || !state.selectedIds.value.length || state.loadingCandidates.value" :loading="state.exporting.value" @click="exportFile">Xuất Excel</UiButton>
        </div>
      </div>
    </template>
  </UiModal>
</template>
