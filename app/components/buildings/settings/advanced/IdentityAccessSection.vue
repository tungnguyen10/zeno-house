<script setup lang="ts">
import { getApiErrorMessage } from '~/utils/api-error'

const source = useBuildingSettingsSource()
const id = source.id
const building = source.building
const assignedManagers = source.assignedManagers
const refreshBuilding = source.refresh
const authStore = useAuthStore()

// Building code
const codeInput = ref('')
const isCodeLocked = computed(() => (building.value?.totalRooms ?? 0) > 0)
const isSavingCode = ref(false)
const codeSaveError = ref<string | null>(null)
const codeSaveSuccess = ref(false)
const codeDirty = computed(() => Boolean(codeInput.value) && codeInput.value !== building.value?.code)

watch(() => building.value?.code, (code) => {
  if (code) codeInput.value = code
}, { immediate: true })

async function handleSaveCode() {
  if (!codeDirty.value) return
  isSavingCode.value = true
  codeSaveError.value = null
  codeSaveSuccess.value = false
  try {
    await apiFetch(`/api/buildings/${id}`, { method: 'PATCH', body: { code: codeInput.value } })
    await refreshBuilding()
    codeSaveSuccess.value = true
    setTimeout(() => { codeSaveSuccess.value = false }, 3000)
  }
  catch (err: unknown) {
    codeSaveError.value = getApiErrorMessage(err, 'Không thể lưu code. Vui lòng thử lại.')
  }
  finally {
    isSavingCode.value = false
  }
}
</script>

<template>
  <UiSection
    title="Mã tòa nhà"
    description="Dùng trong URL và tên hợp đồng. Khóa sau khi tòa nhà đã có phòng."
  >
    <UiSurfacePanel density="compact">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UiInput
          v-model="codeInput"
          label="Code"
          :disabled="isCodeLocked"
          :title="isCodeLocked ? 'Không thể đổi vì tòa nhà đã có phòng' : undefined"
          placeholder="vd: zhpn"
          input-class="font-mono"
          class="flex-1 min-w-0"
        />
        <div class="flex items-center gap-2 sm:pb-0.5">
          <UiButton
            v-if="!isCodeLocked"
            size="sm"
            :loading="isSavingCode"
            :disabled="!codeDirty"
            @click="handleSaveCode"
          >
            Lưu
          </UiButton>
          <span
            v-else
            class="inline-flex items-center gap-1.5 rounded-md border border-ui-border bg-ui-deep/40 px-2 py-1 text-xs text-ui-muted"
          >
            <IconLock class="h-3.5 w-3.5" aria-hidden="true" />
            Đã khóa · {{ building?.totalRooms }} phòng
          </span>
        </div>
      </div>
      <UiAlert v-if="codeSaveError" severity="danger" class="mt-3">
        {{ codeSaveError }}
      </UiAlert>
      <p v-if="codeSaveSuccess" class="mt-2 text-xs text-status-success">
        Code đã được lưu.
      </p>
    </UiSurfacePanel>
  </UiSection>

  <UiSection
    v-if="authStore.canManageUsers"
    title="Managers"
    description="Những manager đang được phân quyền vào tòa nhà này."
  >
    <template #actions>
      <NuxtLink to="/dashboard/settings/managers" class="text-sm text-ui-accent hover:text-ui-accent/80 transition-colors">
        Quản lý phân quyền
      </NuxtLink>
    </template>
    <UiSurfacePanel density="compact">
      <div v-if="assignedManagers.length === 0" class="text-sm text-ui-muted">
        Chưa có manager nào được gán.
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <span
          v-for="manager in assignedManagers"
          :key="manager.id"
          class="rounded-md border border-ui-border bg-ui-deep px-3 py-2 text-sm text-ui-primary"
        >
          {{ manager.name ?? manager.email ?? manager.id }}
        </span>
      </div>
    </UiSurfacePanel>
  </UiSection>
</template>
