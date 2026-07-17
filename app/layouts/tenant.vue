<script setup lang="ts">
// Tenant portal shell — native-like app frame. Deliberately renders NONE of the
// internal shell (no AppSidebar, no AppHeader, no AppAiDevChat, no UiToastHost).
// Fixed header + bottom tab bar; the content region is the only scroll surface.
</script>

<template>
  <div class="portal-shell flex h-[100dvh] flex-col overflow-hidden font-inter">
    <PortalHeader />
    <main class="relative flex-1 overflow-y-auto overscroll-contain">
      <slot />
    </main>
    <PortalTabBar />
    <PortalToastHost />
    <PortalInstallPrompt />
  </div>
</template>
