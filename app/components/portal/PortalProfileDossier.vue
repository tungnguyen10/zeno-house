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

function displayValue(value: string | null | undefined): string {
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
      { label: 'Nghề nghiệp', value: displayValue(props.profile.occupation) },
    ],
  },
  {
    title: 'Liên hệ',
    rows: [
      { label: 'Số điện thoại', value: props.profile.phone },
      { label: 'Email', value: displayValue(props.profile.email) },
      { label: 'Địa chỉ thường trú', value: displayValue(props.profile.permanentAddress) },
    ],
  },
  {
    title: 'Liên hệ khẩn cấp',
    rows: [
      { label: 'Người liên hệ', value: displayValue(props.profile.emergencyContactName) },
      { label: 'Số điện thoại', value: displayValue(props.profile.emergencyContactPhone) },
    ],
  },
  {
    title: 'Ghi chú',
    rows: [
      { label: 'Nội dung', value: displayValue(props.profile.notes) },
    ],
  },
])

const identityRows = computed<DossierRow[]>(() => [
  { label: 'Số CCCD/CMND', value: displayValue(props.profile.idNumber) },
  { label: 'Ngày cấp', value: dateOf(props.profile.idIssuedDate) },
  { label: 'Nơi cấp', value: displayValue(props.profile.idIssuedPlace) },
])
</script>

<template>
  <div class="space-y-5">
    <!-- Membership identity card: accent band + monogram, tenant code, status. -->
    <PortalCard :padded="false" class="overflow-hidden">
      <div class="flex items-center gap-4 bg-smoke-blue px-4 py-4">
        <span
          class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white portal-type-heading text-theme shadow-[var(--portal-elevation-resting)]"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="break-words portal-type-heading text-title">
            {{ profile.fullName }}
          </p>
          <p class="mt-0.5 portal-type-caption tabular-nums text-body">
            {{ profile.code }}
          </p>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 border-t border-border-light px-4 py-3">
        <span class="inline-flex min-w-0 items-center gap-2 portal-type-caption text-body">
          <IconMail class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 break-all">{{ displayValue(profile.email) }}</span>
        </span>
        <PortalChip
          class="shrink-0"
          :tone="profile.status === 'active' ? 'success' : 'neutral'"
        >
          {{ statusLabel }}
        </PortalChip>
      </div>
    </PortalCard>

    <section aria-labelledby="profile-personal-heading">
      <h2
        id="profile-personal-heading"
        class="mb-2 px-1 portal-type-heading text-title"
      >
        Hồ sơ cá nhân
      </h2>
      <PortalCard :padded="false" class="pb-2">
        <div
          v-for="(group, groupIndex) in personalGroups"
          :key="group.title"
          :class="groupIndex > 0 ? 'border-t border-border-light' : undefined"
        >
          <h3 class="px-4 pb-1 pt-3.5 portal-type-label uppercase tracking-wider text-body opacity-60">
            {{ group.title }}
          </h3>
          <dl class="divide-y divide-border-light">
            <div
              v-for="row in group.rows"
              :key="row.label"
              class="grid min-w-0 gap-0.5 px-4 py-2.5 sm:grid-cols-[minmax(7rem,38%)_minmax(0,1fr)] sm:gap-4"
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
        Thông tin định danh
      </h2>
      <PortalCard :padded="false" class="pb-2">
        <p class="flex items-start gap-2 px-4 pb-2 pt-4 portal-type-caption text-body">
          <IconShield class="mt-0.5 h-4 w-4 shrink-0 text-theme" aria-hidden="true" />
          <span>Thông tin trên giấy tờ tùy thân dùng để đối chiếu hồ sơ.</span>
        </p>
        <dl class="divide-y divide-border-light border-t border-border-light">
          <div
            v-for="row in identityRows"
            :key="row.label"
            class="grid min-w-0 gap-0.5 px-4 py-2.5 sm:grid-cols-[minmax(7rem,38%)_minmax(0,1fr)] sm:gap-4"
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
