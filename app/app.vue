<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = computed(() => config.public.siteUrl || 'http://localhost:3000')
const isPublicRoute = computed(() => route.path === '/')

useSeoMeta({
  robots: () => isPublicRoute.value ? 'index, follow' : 'noindex, nofollow',
  ogUrl: () => isPublicRoute.value ? siteUrl.value : undefined,
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: computed(() => isPublicRoute.value ? siteUrl.value : undefined),
    },
  ],
})

// The scrollable region is an inner `#main-content` div, not the window, so
// Nuxt's default scroll-to-top on navigation never resets it — do it here.
watch(() => route.fullPath, () => {
  if (typeof document === 'undefined') return
  document.getElementById('main-content')?.scrollTo({ top: 0 })
})
</script>

<template>
  <div>
    <NuxtLoadingIndicator color="var(--color-accent)" />
    <NuxtRouteAnnouncer />
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ui-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ui-primary focus:ring-2 focus:ring-ui-accent/40"
    >
      Chuyển đến nội dung chính
    </a>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PortalInstallPrompt />
  </div>
</template>
