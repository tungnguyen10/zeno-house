import type {
  AssignmentBuilding,
  AssignmentCreatePayload,
  AssignmentUpdatePayload,
  UserBuildingAssignment,
} from '~/types/assignments'
import type { ManagedUser, ManagedUserWithAssignments } from '~/types/users'
import type { UserCreateInput, UserUpdateInput } from '~/utils/validators/users'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useManagerAssignments() {
  const {
    data: assignmentsData,
    status,
    error,
    refresh: refreshAssignments,
  } = useFetch<ApiSuccess<ManagedUserWithAssignments[]>>('/api/assignments')

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

  const users = computed(() => assignmentsData.value?.data ?? [])
  const buildingsWithoutManager = computed(() => unassignedData.value?.data ?? [])
  const buildings = computed(() => buildingsData.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function refresh() {
    await Promise.all([refreshAssignments(), refreshUnassigned(), refreshBuildings()])
  }

  async function createUser(input: UserCreateInput): Promise<ManagedUser> {
    const res = await apiFetch<ApiSuccess<ManagedUser>>('/api/users', {
      method: 'POST',
      body: input,
    })
    await refresh()
    return res.data
  }

  async function updateUser(id: string, input: UserUpdateInput): Promise<ManagedUser> {
    const res = await apiFetch<ApiSuccess<ManagedUser>>(`/api/users/${id}`, {
      method: 'PATCH',
      body: input,
    })
    await refresh()
    return res.data
  }

  async function deleteUser(id: string): Promise<void> {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function assign(input: AssignmentCreatePayload): Promise<UserBuildingAssignment> {
    const res = await apiFetch<ApiSuccess<UserBuildingAssignment>>('/api/assignments', {
      method: 'POST',
      body: input,
    })
    await refresh()
    return res.data
  }

  async function toggle(id: string, input: AssignmentUpdatePayload): Promise<UserBuildingAssignment> {
    const res = await apiFetch<ApiSuccess<UserBuildingAssignment>>(`/api/assignments/${id}`, {
      method: 'PATCH',
      body: input,
    })
    await refresh()
    return res.data
  }

  async function unassign(id: string): Promise<void> {
    await apiFetch(`/api/assignments/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    users,
    buildings,
    buildingsWithoutManager,
    isLoading,
    error,
    refresh,
    createUser,
    updateUser,
    deleteUser,
    assign,
    toggle,
    unassign,
  }
}
