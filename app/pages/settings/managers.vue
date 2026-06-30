<script setup lang="ts">
import type { ManagerAssignment } from '~/types/assignments'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) return navigateTo('/')
  },
})

const {
  managers,
  buildings,
  buildingsWithoutManager,
  isLoading,
  assign,
  toggle,
  unassign,
} = useManagerAssignments()

const selectedBuildingByManager = ref<Record<string, string>>({})
const busyKey = ref<string | null>(null)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

function assignedBuildingIds(row: ManagerAssignment): Set<string> {
  return new Set(row.assignments.map(assignment => assignment.building_id))
}

function availableBuildings(row: ManagerAssignment) {
  const assigned = assignedBuildingIds(row)
  return buildings.value.filter(building => !assigned.has(building.id))
}

async function handleAssign(row: ManagerAssignment) {
  const buildingId = selectedBuildingByManager.value[row.manager.id]
  if (!buildingId) return
  busyKey.value = `assign:${row.manager.id}`
  message.value = null
  errorMessage.value = null
  try {
    await assign({ user_id: row.manager.id, building_id: buildingId })
    selectedBuildingByManager.value[row.manager.id] = ''
    message.value = 'Đã gán manager vào tòa nhà.'
  }
  catch (err: unknown) {
    errorMessage.value = (err as { data?: { error?: { message?: string } } })?.data?.error?.message
      ?? 'Không thể gán manager.'
  }
  finally {
    busyKey.value = null
  }
}

async function handleToggle(assignmentId: string, nextValue: boolean) {
  busyKey.value = `toggle:${assignmentId}`
  message.value = null
  errorMessage.value = null
  try {
    await toggle(assignmentId, { can_delete_master_data: nextValue })
    message.value = 'Đã cập nhật quyền xóa dữ liệu.'
  }
  catch {
    errorMessage.value = 'Không thể cập nhật quyền xóa dữ liệu.'
  }
  finally {
    busyKey.value = null
  }
}

async function handleUnassign(assignmentId: string) {
  busyKey.value = `unassign:${assignmentId}`
  message.value = null
  errorMessage.value = null
  try {
    await unassign(assignmentId)
    message.value = 'Đã bỏ gán manager khỏi tòa nhà.'
  }
  catch {
    errorMessage.value = 'Không thể bỏ gán manager.'
  }
  finally {
    busyKey.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Manager access"
      description="Phân quyền manager theo tòa nhà và quyền xóa dữ liệu nhạy cảm."
    />

    <UiAlert v-if="errorMessage" severity="danger">
      {{ errorMessage }}
    </UiAlert>
    <UiAlert v-else-if="message" severity="success">
      {{ message }}
    </UiAlert>

    <section
      v-if="buildingsWithoutManager.length > 0"
      class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <h2 class="text-sm font-semibold text-amber-200">
        {{ buildingsWithoutManager.length }} tòa nhà chưa có manager
      </h2>
      <div class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="building in buildingsWithoutManager"
          :key="building.id"
          class="rounded-md border border-amber-500/30 px-2 py-1 text-xs text-amber-100"
        >
          {{ building.name }}
        </span>
      </div>
    </section>

    <div v-if="isLoading" class="rounded-lg border border-dark-border bg-dark-surface p-5 text-sm text-muted">
      Đang tải phân quyền...
    </div>

    <div v-else class="space-y-4">
      <section
        v-for="row in managers"
        :key="row.manager.id"
        class="rounded-lg border border-dark-border bg-dark-surface p-5"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="text-base font-semibold text-white">
              {{ row.manager.name ?? row.manager.email ?? row.manager.id }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ row.assignments.length }} tòa nhà được gán
            </p>
          </div>

          <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="handleAssign(row)">
            <select
              v-model="selectedBuildingByManager[row.manager.id]"
              class="min-w-56 rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/30"
            >
              <option value="">
                Chọn tòa nhà
              </option>
              <option
                v-for="building in availableBuildings(row)"
                :key="building.id"
                :value="building.id"
              >
                {{ building.name }}
              </option>
            </select>
            <UiButton
              type="submit"
              size="sm"
              :loading="busyKey === `assign:${row.manager.id}`"
              :disabled="!selectedBuildingByManager[row.manager.id]"
            >
              Gán
            </UiButton>
          </form>
        </div>

        <div v-if="row.assignments.length === 0" class="mt-4 text-sm text-muted">
          Chưa được gán tòa nhà nào.
        </div>

        <div v-else class="mt-4 overflow-hidden rounded-lg border border-dark-border">
          <div
            v-for="assignment in row.assignments"
            :key="assignment.id"
            class="grid gap-3 border-b border-dark-border px-4 py-3 last:border-b-0 md:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <p class="text-sm font-medium text-white">
                {{ assignment.building?.name ?? assignment.building_id }}
              </p>
              <p class="mt-0.5 text-xs text-muted">
                {{ assignment.building?.code ?? 'building' }}
              </p>
            </div>
            <label class="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-dark-border bg-dark-bg text-cyan focus:ring-cyan/30"
                :checked="assignment.can_delete_master_data"
                :disabled="busyKey === `toggle:${assignment.id}`"
                @change="handleToggle(assignment.id, ($event.target as HTMLInputElement).checked)"
              >
              Cho phép xóa dữ liệu
            </label>
            <UiButton
              size="sm"
              variant="ghost"
              :loading="busyKey === `unassign:${assignment.id}`"
              @click="handleUnassign(assignment.id)"
            >
              Bỏ gán
            </UiButton>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
