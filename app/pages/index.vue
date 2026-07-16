<script setup lang="ts">
import { getRedirectByRole } from '~/utils/auth-redirect'

definePageMeta({ layout: false })

const user = useSupabaseUser()
const role = user.value?.app_metadata?.role as string | null | undefined
await navigateTo(getRedirectByRole(role), { replace: true })
</script>

<template>
  <div />
</template>
