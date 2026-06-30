import type {
  AssignmentBuilding,
  AssignmentCreatePayload,
  AssignmentUpdatePayload,
  ManagerAssignment,
  UserBuildingAssignment,
} from '~/types/assignments'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useManagerAssignments() {
  const {
    data: assignmentsData,
    status,
    error,
    refresh: refreshAssignments,
  } = useFetch<ApiSuccess<ManagerAssignment[]>>('/api/assignments')

  const {
    data: unassignedData,
    refresh: refreshUnassigned,
  } = useFetch<ApiSuccess<AssignmentBuilding[]>>('/api/assignments/buildings-without-manager')

  const {
    data: buildingsData,
    refresh: refreshBuildings,
  } = useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>('/api/buildings', {
    query: { limit: 100, sort: 'name', order: 'asc' },
  })

  const managers = computed(() => assignmentsData.value?.data ?? [])
  const buildingsWithoutManager = computed(() => unassignedData.value?.data ?? [])
  const buildings = computed(() => buildingsData.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function refresh() {
    await Promise.all([refreshAssignments(), refreshUnassigned(), refreshBuildings()])
  }

  async function assign(input: AssignmentCreatePayload): Promise<UserBuildingAssignment> {
    const res = await $fetch<ApiSuccess<UserBuildingAssignment>>('/api/assignments', {
      method: 'POST',
      body: input,
    })
    await refresh()
    return res.data
  }

  async function toggle(id: string, input: AssignmentUpdatePayload): Promise<UserBuildingAssignment> {
    const res = await $fetch<ApiSuccess<UserBuildingAssignment>>(`/api/assignments/${id}`, {
      method: 'PATCH',
      body: input,
    })
    await refresh()
    return res.data
  }

  async function unassign(id: string): Promise<void> {
    await $fetch(`/api/assignments/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    managers,
    buildings,
    buildingsWithoutManager,
    isLoading,
    error,
    refresh,
    assign,
    toggle,
    unassign,
  }
}
