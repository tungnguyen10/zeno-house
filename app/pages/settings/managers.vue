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

const toast = useToast()

const selectedBuildingByManager = ref<Record<string, string>>({})
const busyKey = ref<string | null>(null)

function assignedBuildingIds(row: ManagerAssignment): Set<string> {
  return new Set(row.assignments.map(a => a.building_id))
}

function availableBuildings(row: ManagerAssignment) {
  const assigned = assignedBuildingIds(row)
  return buildings.value.filter(b => !assigned.has(b.id))
}

function availableBuildingOptions(row: ManagerAssignment) {
  return [
    { value: '', label: 'Chọn tòa nhà…' },
    ...availableBuildings(row).map(b => ({ value: b.id, label: b.name })),
  ]
}

async function handleAssign(row: ManagerAssignment) {
  const buildingId = selectedBuildingByManager.value[row.manager.id]
  if (!buildingId) return
  busyKey.value = `assign:${row.manager.id}`
  try {
    await assign({ user_id: row.manager.id, building_id: buildingId })
    selectedBuildingByManager.value[row.manager.id] = ''
    toast.success('Đã gán manager vào tòa nhà.')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message ?? 'Không thể gán manager.'
    toast.error(msg)
  }
  finally {
    busyKey.value = null
  }
}

async function handleToggle(assignmentId: string, nextValue: boolean) {
  busyKey.value = `toggle:${assignmentId}`
  try {
    await toggle(assignmentId, { can_delete_master_data: nextValue })
    toast.success('Đã cập nhật quyền xóa dữ liệu.')
  }
  catch {
    toast.error('Không thể cập nhật quyền xóa dữ liệu.')
  }
  finally {
    busyKey.value = null
  }
}

async function handleUnassign(assignmentId: string) {
  busyKey.value = `unassign:${assignmentId}`
  try {
    await unassign(assignmentId)
    toast.success('Đã bỏ gán manager khỏi tòa nhà.')
  }
  catch {
    toast.error('Không thể bỏ gán manager.')
  }
  finally {
    busyKey.value = null
  }
}

function managerInitials(row: ManagerAssignment): string {
  const name = row.manager.name ?? row.manager.email ?? ''
  return name.slice(0, 2).toUpperCase() || '??'
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Manager access"
      description="Phân quyền manager theo tòa nhà và quyền xóa dữ liệu nhạy cảm."
    />

    <!-- Buildings without manager alert -->
    <UiAlert
      v-if="buildingsWithoutManager.length > 0"
      severity="warning"
      :title="`${buildingsWithoutManager.length} tòa nhà chưa có manager`"
    >
      <div class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="building in buildingsWithoutManager"
          :key="building.id"
          class="inline-flex items-center rounded-md border border-warning/30 bg-warning/5 px-2 py-0.5 text-xs text-warning"
        >
          {{ building.name }}
        </span>
      </div>
    </UiAlert>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <UiEmptyState
      v-else-if="managers.length === 0"
      title="Chưa có manager nào"
      description="Mời manager vào hệ thống để bắt đầu phân quyền tòa nhà."
    />

    <!-- Manager list -->
    <div v-else class="space-y-3">
      <div
        v-for="row in managers"
        :key="row.manager.id"
        class="overflow-hidden rounded-lg border border-dark-border bg-dark-surface"
      >
        <!-- Card header -->
        <div class="flex flex-col gap-3 border-b border-dark-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <!-- Avatar -->
            <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-sm font-semibold text-cyan">
              {{ managerInitials(row) }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">
                {{ row.manager.name ?? row.manager.email ?? row.manager.id }}
              </p>
              <p v-if="row.manager.name && row.manager.email" class="truncate text-xs text-muted">
                {{ row.manager.email }}
              </p>
            </div>
            <UiBadge
              v-if="row.assignments.length === 0"
              variant="warning"
              class="ml-1 shrink-0"
            >
              Chưa có tòa nhà
            </UiBadge>
            <span
              v-else
              class="ml-1 shrink-0 rounded-md border border-dark-border bg-dark-deep/40 px-2 py-0.5 text-xs font-medium text-muted"
            >
              {{ row.assignments.length }} tòa nhà
            </span>
          </div>

          <!-- Assign form -->
          <form
            v-if="availableBuildings(row).length > 0"
            class="flex shrink-0 items-center gap-2"
            @submit.prevent="handleAssign(row)"
          >
            <UiSelect
              v-model="selectedBuildingByManager[row.manager.id]"
              :options="availableBuildingOptions(row)"
              density="compact"
              aria-label="Chọn tòa nhà để gán"
              class="w-56"
            />
            <UiButton
              type="submit"
              size="sm"
              :loading="busyKey === `assign:${row.manager.id}`"
              :disabled="!selectedBuildingByManager[row.manager.id]"
            >
              <IconPlus class="h-3.5 w-3.5" aria-hidden="true" />
              Gán
            </UiButton>
          </form>
          <span v-else class="text-xs text-muted">
            Đã gán tất cả tòa nhà
          </span>
        </div>

        <!-- Assignments list -->
        <ul v-if="row.assignments.length > 0" class="divide-y divide-dark-border">
          <li
            v-for="assignment in row.assignments"
            :key="assignment.id"
            class="flex items-center gap-4 px-4 py-2.5"
          >
            <!-- Building info -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">
                {{ assignment.building?.name ?? assignment.building_id }}
              </p>
              <p v-if="assignment.building?.code" class="mt-0.5 font-mono text-xs text-muted">
                {{ assignment.building.code }}
              </p>
            </div>

            <!-- Delete permission toggle -->
            <label
              class="flex shrink-0 items-center gap-2 rounded-md border border-dark-border/60 bg-dark-deep/30 px-2.5 py-1"
              :class="!busyKey && 'cursor-pointer hover:border-dark-border'"
            >
              <UiToggle
                :model-value="assignment.can_delete_master_data"
                size="sm"
                aria-label="Cho phép xóa dữ liệu"
                :disabled="busyKey === `toggle:${assignment.id}`"
                @update:model-value="handleToggle(assignment.id, $event)"
              />
              <span class="whitespace-nowrap text-xs text-muted">Cho xóa dữ liệu</span>
            </label>

            <!-- Unassign -->
            <UiButton
              size="sm"
              variant="ghost"
              :loading="busyKey === `unassign:${assignment.id}`"
              @click="handleUnassign(assignment.id)"
            >
              <IconTrash class="h-3.5 w-3.5" aria-hidden="true" />
              <span class="sr-only sm:not-sr-only">Bỏ gán</span>
            </UiButton>
          </li>
        </ul>

        <!-- Empty assignments -->
        <div v-else class="flex items-center gap-2 px-4 py-3 text-xs text-muted">
          <IconAlertCircle class="h-4 w-4 shrink-0 text-warning/70" aria-hidden="true" />
          <span>Manager này chưa được gán tòa nhà nào.</span>
        </div>
      </div>
    </div>
  </div>
</template>
