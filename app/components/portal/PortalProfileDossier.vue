<script setup lang="ts">
import type { TenantGender, TenantProfile } from '~/types/tenant-portal'

interface DossierRow {
  label: string
  value: string
}

interface DossierGroup {
  title: string
  rows: DossierRow[]
}

const props = defineProps<{
  profile: TenantProfile
}>()

const genderLabels: Record<TenantGender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
}

const missing = 'Chưa cập nhật'

function valueOf(value: string | null | undefined): string {
  return value?.trim() || missing
}

function dateOf(value: string | null): string {
  if (!value) return missing
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

const initials = computed(() => {
  const words = props.profile.fullName.trim().split(/\s+/)
  if (words.length === 1) return words[0]?.[0]?.toUpperCase() ?? '?'
  return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
})

const statusLabel = computed(() => (
  props.profile.status === 'active' ? 'Đang thuê' : 'Đã lưu trữ'
))

const personalGroups = computed<DossierGroup[]>(() => [
  {
    title: 'Thông tin cá nhân',
    rows: [
      { label: 'Họ và tên', value: props.profile.fullName },
      {
        label: 'Giới tính',
        value: props.profile.gender ? genderLabels[props.profile.gender] : missing,
      },
      { label: 'Ngày sinh', value: dateOf(props.profile.dateOfBirth) },
      { label: 'Nghề nghiệp', value: valueOf(props.profile.occupation) },
    ],
  },
  {
    title: 'Liên hệ',
    rows: [
      { label: 'Số điện thoại', value: props.profile.phone },
      { label: 'Email', value: valueOf(props.profile.email) },
      { label: 'Địa chỉ thường trú', value: valueOf(props.profile.permanentAddress) },
    ],
  },
  {
    title: 'Liên hệ khẩn cấp',
    rows: [
      { label: 'Người liên hệ', value: valueOf(props.profile.emergencyContactName) },
      { label: 'Số điện thoại', value: valueOf(props.profile.emergencyContactPhone) },
    ],
  },
  {
    title: 'Ghi chú',
    rows: [
      { label: 'Nội dung', value: valueOf(props.profile.notes) },
    ],
  },
])

const identityRows = computed<DossierRow[]>(() => [
  { label: 'Số CCCD/CMND', value: valueOf(props.profile.idNumber) },
  { label: 'Ngày cấp', value: dateOf(props.profile.idIssuedDate) },
  { label: 'Nơi cấp', value: valueOf(props.profile.idIssuedPlace) },
])
</script>

<template>
  <div class="space-y-5">
    <PortalCard>
      <div class="flex min-w-0 items-center gap-4">
        <span
          class="flex size-16 shrink-0 items-center justify-center rounded-full bg-smoke-blue portal-type-heading text-theme"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="break-words portal-type-heading text-title">
            {{ profile.fullName }}
          </p>
          <p class="mt-1 portal-type-caption text-body">
            {{ profile.code }}
          </p>
          <p class="mt-0.5 break-all portal-type-caption text-body">
            {{ valueOf(profile.email) }}
          </p>
          <PortalChip
            class="mt-2"
            :tone="profile.status === 'active' ? 'success' : 'neutral'"
          >
            {{ statusLabel }}
          </PortalChip>
        </div>
      </div>
    </PortalCard>

    <section aria-labelledby="profile-personal-heading">
      <h2
        id="profile-personal-heading"
        class="mb-2 px-1 portal-type-heading text-title"
      >
        Hồ sơ cá nhân
      </h2>
      <PortalCard :padded="false">
        <div
          v-for="(group, groupIndex) in personalGroups"
          :key="group.title"
          :class="groupIndex > 0 ? 'border-t border-border-light' : undefined"
        >
          <h3 class="bg-smoke px-4 py-2 portal-type-label text-body">
            {{ group.title }}
          </h3>
          <dl class="divide-y divide-border-light">
            <div
              v-for="row in group.rows"
              :key="row.label"
              class="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(7rem,40%)_minmax(0,1fr)] sm:gap-4"
            >
              <dt class="portal-type-caption text-body">
                {{ row.label }}
              </dt>
              <dd class="min-w-0 whitespace-pre-line break-words portal-type-body font-medium text-title sm:text-right">
                {{ row.value }}
              </dd>
            </div>
          </dl>
        </div>
      </PortalCard>
    </section>

    <section aria-labelledby="profile-identity-heading">
      <h2
        id="profile-identity-heading"
        class="mb-2 px-1 portal-type-heading text-title"
      >
        Định danh đã xác minh
      </h2>
      <PortalCard :padded="false">
        <p class="border-b border-border-light bg-smoke px-4 py-3 portal-type-caption text-body">
          Thông tin này do ban quản lý xác minh. Liên hệ ban quản lý nếu cần điều chỉnh.
        </p>
        <dl class="divide-y divide-border-light">
          <div
            v-for="row in identityRows"
            :key="row.label"
            class="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(7rem,40%)_minmax(0,1fr)] sm:gap-4"
          >
            <dt class="portal-type-caption text-body">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 break-words portal-type-body font-medium text-title sm:text-right">
              {{ row.value }}
            </dd>
          </div>
        </dl>
      </PortalCard>
    </section>
  </div>
</template>
