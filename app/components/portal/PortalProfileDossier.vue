<script setup lang="ts">
import type { TenantGender, TenantProfile } from '~/types/tenant-portal'

interface DossierRow {
  label: string
  value: string
  wide?: boolean
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

const statusTone = computed<'success' | 'neutral'>(() => (
  props.profile.status === 'active' ? 'success' : 'neutral'
))

const personalRows = computed<DossierRow[]>(() => [
  {
    label: 'Giới tính',
    value: props.profile.gender ? genderLabels[props.profile.gender] : missing,
  },
  { label: 'Ngày sinh', value: dateOf(props.profile.dateOfBirth) },
  { label: 'Nghề nghiệp', value: displayValue(props.profile.occupation), wide: true },
])

const contactRows = computed<DossierRow[]>(() => [
  { label: 'Số điện thoại', value: props.profile.phone },
  { label: 'Email', value: displayValue(props.profile.email) },
  { label: 'Địa chỉ thường trú', value: displayValue(props.profile.permanentAddress), wide: true },
])

const identityRows = computed<DossierRow[]>(() => [
  { label: 'Số CCCD/CMND', value: displayValue(props.profile.idNumber), wide: true },
  { label: 'Ngày cấp', value: dateOf(props.profile.idIssuedDate) },
  { label: 'Nơi cấp', value: displayValue(props.profile.idIssuedPlace) },
])

const emergencyRows = computed<DossierRow[]>(() => [
  { label: 'Người liên hệ', value: displayValue(props.profile.emergencyContactName) },
  { label: 'Số điện thoại', value: displayValue(props.profile.emergencyContactPhone) },
])
</script>

<template>
  <div class="space-y-5">
    <PortalCard :padded="false" class="overflow-hidden">
      <div class="flex items-start gap-3.5 p-4">
        <span
          class="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-theme/30 bg-smoke-blue text-lg font-semibold text-theme shadow-[var(--portal-elevation-resting)]"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="break-words text-lg font-semibold leading-6 text-title">
            {{ profile.fullName }}
          </p>
          <p class="mt-0.5 portal-type-caption tabular-nums text-body">
            {{ profile.code }}
          </p>
        </div>
        <PortalChip :tone="statusTone" class="shrink-0">
          {{ statusLabel }}
        </PortalChip>
      </div>

      <NuxtLink
        to="/portal/profile/edit"
        class="flex min-h-14 items-center gap-3 border-t border-border-light px-4 py-3 transition-colors hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40 motion-reduce:transition-none"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme"
          aria-hidden="true"
        >
          <IconPencilSquare class="h-4 w-4" />
        </span>
        <span class="min-w-0 flex-1 portal-type-body font-semibold text-title">
          Sửa thông tin
        </span>
        <IconChevronRight class="h-5 w-5 shrink-0 text-body" aria-hidden="true" />
      </NuxtLink>
    </PortalCard>

    <section data-profile-section aria-labelledby="profile-personal-heading" class="space-y-3">
      <div class="flex items-center gap-2 px-1">
        <IconUser class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
        <h2 id="profile-personal-heading" class="portal-type-heading text-title">
          Thông tin cá nhân
        </h2>
      </div>
      <PortalCard>
        <dl class="grid grid-cols-2 gap-2.5">
          <div
            v-for="row in personalRows"
            :key="row.label"
            class="min-w-0 rounded-xl border border-border-light bg-smoke px-3.5 py-2.5"
            :class="row.wide ? 'col-span-2' : ''"
          >
            <dt class="portal-type-caption text-body">
              {{ row.label }}
            </dt>
            <dd class="mt-1 whitespace-pre-line break-words portal-type-body font-semibold text-title">
              {{ row.value }}
            </dd>
          </div>
        </dl>
      </PortalCard>
    </section>

    <section data-profile-section aria-labelledby="profile-contact-heading" class="space-y-3">
      <div class="flex items-center gap-2 px-1">
        <IconPhone class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
        <h2 id="profile-contact-heading" class="portal-type-heading text-title">
          Liên hệ
        </h2>
      </div>
      <PortalCard>
        <dl class="grid grid-cols-2 gap-2.5">
          <div
            v-for="row in contactRows"
            :key="row.label"
            class="min-w-0 rounded-xl border border-border-light bg-smoke px-3.5 py-2.5"
            :class="row.wide ? 'col-span-2' : ''"
          >
            <dt class="portal-type-caption text-body">
              {{ row.label }}
            </dt>
            <dd class="mt-1 whitespace-pre-line break-words portal-type-body font-semibold text-title">
              {{ row.value }}
            </dd>
          </div>
        </dl>
      </PortalCard>
    </section>

    <section data-profile-section aria-labelledby="profile-identity-heading" class="space-y-3">
      <div class="flex items-center gap-2 px-1">
        <IconShield class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
        <h2 id="profile-identity-heading" class="portal-type-heading text-title">
          Giấy tờ tùy thân
        </h2>
      </div>
      <PortalCard>
        <p class="portal-type-caption text-body">
          Thông tin trên giấy tờ tùy thân dùng để đối chiếu hồ sơ.
        </p>
        <dl class="mt-3 grid grid-cols-2 gap-2.5">
          <div
            v-for="row in identityRows"
            :key="row.label"
            class="min-w-0 rounded-xl border border-border-light bg-smoke px-3.5 py-2.5"
            :class="row.wide ? 'col-span-2' : ''"
          >
            <dt class="portal-type-caption text-body">
              {{ row.label }}
            </dt>
            <dd class="mt-1 break-words portal-type-body font-semibold text-title">
              {{ row.value }}
            </dd>
          </div>
        </dl>
      </PortalCard>
    </section>

    <section data-profile-section aria-labelledby="profile-emergency-heading" class="space-y-3">
      <div class="flex items-center gap-2 px-1">
        <IconUsers class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
        <h2 id="profile-emergency-heading" class="portal-type-heading text-title">
          Liên hệ khẩn cấp
        </h2>
      </div>
      <PortalCard>
        <dl class="grid grid-cols-2 gap-2.5">
          <div
            v-for="row in emergencyRows"
            :key="row.label"
            class="min-w-0 rounded-xl border border-border-light bg-smoke px-3.5 py-2.5"
            :class="row.wide ? 'col-span-2' : ''"
          >
            <dt class="portal-type-caption text-body">
              {{ row.label }}
            </dt>
            <dd class="mt-1 break-words portal-type-body font-semibold text-title">
              {{ row.value }}
            </dd>
          </div>
        </dl>
      </PortalCard>
    </section>

    <section data-profile-section aria-labelledby="profile-notes-heading" class="space-y-3">
      <div class="flex items-center gap-2 px-1">
        <IconDocumentText class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
        <h2 id="profile-notes-heading" class="portal-type-heading text-title">
          Ghi chú
        </h2>
      </div>
      <PortalCard>
        <p class="whitespace-pre-line break-words portal-type-body text-body">
          {{ displayValue(profile.notes) }}
        </p>
      </PortalCard>
    </section>
  </div>
</template>
