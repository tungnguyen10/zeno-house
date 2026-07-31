<script setup lang="ts">
// Portal launch splash — a native-app style brand moment shown while the
// bootstrap data resolves. Signature: a thin teal "tracking" bar that sweeps
// beneath the wordmark (a nod to the portal's MapTrack heritage), rather than a
// generic whole-logo pulse. Motion is disabled under reduced-motion.
//
// Uses a dedicated IconLogoSplash rather than IconLogo: the base logo's
// `userSpaceOnUse` gradient ids collide with the sidebar's IconLogo when both
// render at once (the larger instance loses its gold fill). logo-splash.svg
// carries unique gradient ids while keeping `currentColor` on the wordmark so it
// still adapts to the light/dark portal theme.
</script>

<template>
  <div
    class="portal-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[color:var(--portal-bg)] text-[color:var(--portal-title)]"
    role="status"
    aria-label="Đang mở không gian của bạn"
  >
    <IconLogoSplash class="portal-splash__mark h-11 w-auto" />
    <div class="portal-splash__track relative h-1 w-40 overflow-hidden rounded-full bg-[color:var(--portal-accent-soft)]">
      <span class="portal-splash__beam absolute inset-y-0 left-0 w-10 rounded-full bg-[color:var(--portal-accent)]" />
    </div>
  </div>
</template>

<style scoped>
.portal-splash__mark {
  animation: portal-splash-rise 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.portal-splash__beam {
  animation: portal-splash-sweep 1150ms cubic-bezier(0.65, 0, 0.35, 1) infinite alternate;
}

@keyframes portal-splash-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes portal-splash-sweep {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(400%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .portal-splash__mark {
    animation: none;
  }

  .portal-splash__beam {
    animation: none;
    width: 100%;
    opacity: 0.6;
  }
}
</style>
