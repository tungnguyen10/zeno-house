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
    <div
      v-if="buildingsWithoutManager.length > 0"
      class="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3"
    >
      <span class="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
      <div>
        <p class="text-sm font-medium text-amber-200">
          {{ buildingsWithoutManager.length }} tòa nhà chưa có manager
        </p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <span
            v-for="building in buildingsWithoutManager"
            :key="building.id"
            class="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100"
          >
            {{ building.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-lg" />
    </div>

    <!-- Manager list -->
    <div v-else class="space-y-3">
      <div
        v-for="row in managers"
        :key="row.manager.id"
        class="overflow-hidden rounded-lg border border-dark-border bg-dark-surface"
      >
        <!-- Card header -->
        <div class="flex items-center justify-between gap-4 border-b border-dark-border px-5 py-4">
          <div class="flex items-center gap-3 min-w-0">
            <!-- Avatar -->
            <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-sm font-semibold text-cyan">
              {{ managerInitials(row) }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">
                {{ row.manager.name ?? row.manager.email ?? row.manager.id }}
              </p>
              <p class="text-xs text-muted">
                {{ row.assignments.length === 0 ? 'Chưa được gán tòa nhà' : `${row.assignments.length} tòa nhà` }}
              </p>
            </div>
          </div>

          <!-- Assign form -->
          <form class="flex shrink-0 items-center gap-2" @submit.prevent="handleAssign(row)">
            <UiSelect
              v-model="selectedBuildingByManager[row.manager.id]"
              :options="availableBuildingOptions(row)"
              density="compact"
              class="w-48"
            />
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

        <!-- Assignments list -->
        <div v-if="row.assignments.length > 0">
          <div
            v-for="assignment in row.assignments"
            :key="assignment.id"
            class="flex items-center gap-4 border-b border-dark-border/50 px-5 py-3 last:border-b-0"
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
            <div class="flex items-center gap-2.5 shrink-0">
              <UiToggle
                :model-value="assignment.can_delete_master_data"
                size="sm"
                :disabled="busyKey === `toggle:${assignment.id}`"
                @update:model-value="handleToggle(assignment.id, $event)"
              />
              <span class="text-xs text-muted whitespace-nowrap">Cho xóa dữ liệu</span>
            </div>

            <!-- Unassign -->
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

        <!-- Empty assignments -->
        <div v-else class="px-5 py-4 text-sm italic text-muted/60">
          Chưa được gán tòa nhà nào.
        </div>
      </div>
    </div>
  </div>
</template>
