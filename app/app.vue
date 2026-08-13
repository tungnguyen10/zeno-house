<template>
  <div>
    <NuxtLoadingIndicator color="var(--color-accent)" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PortalInstallPrompt />
  </div>
</template>
