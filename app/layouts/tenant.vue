<script setup lang="ts">
// Tenant portal shell — responsive app frame. On mobile it renders a native-like
// stack (sticky header + fixed bottom tab bar). On web (lg+) it becomes a
// centered app with a left navigation rail and a comfortable reading column.
// It deliberately renders NONE of the internal admin shell.
</script>

<template>
  <div class="portal-shell flex h-[100dvh] justify-center overflow-hidden font-inter">
    <div class="flex h-full w-full max-w-7xl overflow-hidden bg-[color:var(--portal-bg)] lg:border-x lg:border-border-light lg:shadow-[var(--portal-elevation-raised)]">
      <PortalSidebar />
      <div class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <PortalHeader />
        <main class="relative flex-1 overflow-y-auto overscroll-contain">
          <div class="mx-auto w-full max-w-5xl">
            <slot />
          </div>
        </main>
        <PortalTabBar />
      </div>
    </div>
    <PortalToastHost />
    <PortalInstallPrompt />
    <!-- Stable, portal-scoped mount point for overlays (bottom sheets). Lives in
         the layout so it survives page transitions, and sits inside
         `.portal-shell` so teleported overlays inherit the portal tokens. -->
    <div id="portal-overlay-root" />
  </div>
</template>
