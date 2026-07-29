<script setup lang="ts">
import type { TenantGender, TenantProfile } from '~/types/tenant-portal'

interface DossierRow {
  label: string
  value: string
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

const personalRows = computed<DossierRow[]>(() => [
  {
    label: 'Giới tính',
    value: props.profile.gender ? genderLabels[props.profile.gender] : missing,
  },
  { label: 'Ngày sinh', value: dateOf(props.profile.dateOfBirth) },
  { label: 'Nghề nghiệp', value: displayValue(props.profile.occupation) },
])

const contactRows = computed<DossierRow[]>(() => [
  { label: 'Số điện thoại', value: props.profile.phone },
  { label: 'Email', value: displayValue(props.profile.email) },
  { label: 'Địa chỉ thường trú', value: displayValue(props.profile.permanentAddress) },
])

const identityRows = computed<DossierRow[]>(() => [
  { label: 'Số CCCD/CMND', value: displayValue(props.profile.idNumber) },
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
    <PortalCard class="flex flex-col items-center gap-4 px-4 py-5 text-center">
      <div class="flex flex-col items-center gap-3">
        <span
          class="flex size-[76px] shrink-0 items-center justify-center rounded-full border border-theme/30 bg-smoke-blue text-xl font-semibold text-theme shadow-[var(--portal-elevation-resting)]"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0">
          <p class="break-words text-xl font-semibold uppercase leading-7 text-title">
            {{ profile.fullName }}
          </p>
          <div class="mt-1 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span class="portal-type-caption tabular-nums text-body">
              {{ profile.code }}
            </span>
            <span
              class="size-1.5 shrink-0 rounded-full"
              :class="profile.status === 'active'
                ? 'bg-[color:var(--portal-positive)]'
                : 'bg-[color:var(--portal-muted)]'"
              aria-hidden="true"
            />
            <span
              class="portal-type-caption font-medium"
              :class="profile.status === 'active' ? 'text-[color:var(--portal-positive-ink)]' : 'text-body'"
            >
              {{ statusLabel }}
            </span>
          </div>
        </div>
      </div>

      <NuxtLink
        to="/portal/profile/edit"
        class="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border-light bg-white px-4 portal-type-caption font-semibold text-body transition-colors hover:border-theme/40 hover:bg-smoke-blue hover:text-theme active:bg-smoke-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
        Sửa thông tin
      </NuxtLink>
    </PortalCard>

    <section data-profile-section aria-labelledby="profile-personal-heading" class="space-y-3">
      <div class="flex items-center gap-2 px-1">
        <IconUser class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
        <h2 id="profile-personal-heading" class="portal-type-heading text-title">
          Thông tin cá nhân
        </h2>
      </div>
      <PortalCard :padded="false" class="overflow-hidden">
        <dl class="divide-y divide-border-light">
          <div
            v-for="row in personalRows"
            :key="row.label"
            class="grid min-w-0 grid-cols-[minmax(6.5rem,38%)_minmax(0,1fr)] gap-3 px-4 py-3"
          >
            <dt class="portal-type-body text-body">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 whitespace-pre-line break-words text-right portal-type-body font-medium text-[color:var(--portal-accent-hover)]">
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
      <PortalCard :padded="false" class="overflow-hidden">
        <dl class="divide-y divide-border-light">
          <div
            v-for="row in contactRows"
            :key="row.label"
            class="grid min-w-0 grid-cols-[minmax(6.5rem,38%)_minmax(0,1fr)] gap-3 px-4 py-3"
          >
            <dt class="portal-type-body text-body">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 whitespace-pre-line break-words text-right portal-type-body font-medium text-[color:var(--portal-accent-hover)]">
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
      <PortalCard :padded="false" class="overflow-hidden">
        <p class="border-b border-border-light px-4 py-3 portal-type-caption text-body">
          Thông tin trên giấy tờ tùy thân dùng để đối chiếu hồ sơ.
        </p>
        <dl class="divide-y divide-border-light">
          <div
            v-for="row in identityRows"
            :key="row.label"
            class="grid min-w-0 grid-cols-[minmax(6.5rem,38%)_minmax(0,1fr)] gap-3 px-4 py-3"
          >
            <dt class="portal-type-body text-body">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 break-words text-right portal-type-body font-medium text-[color:var(--portal-accent-hover)]">
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
      <PortalCard :padded="false" class="overflow-hidden">
        <dl class="divide-y divide-border-light">
          <div
            v-for="row in emergencyRows"
            :key="row.label"
            class="grid min-w-0 grid-cols-[minmax(6.5rem,38%)_minmax(0,1fr)] gap-3 px-4 py-3"
          >
            <dt class="portal-type-body text-body">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 break-words text-right portal-type-body font-medium text-[color:var(--portal-accent-hover)]">
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
