<template>
  <div class="relative flex min-h-screen flex-col overflow-hidden bg-dark text-white">
    <!-- Operations console backdrop: dot mesh + cyan glow + depth gradient (static, reduced-motion safe) -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div class="auth-mesh absolute inset-0" />
      <div class="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-cyan/10 blur-3xl" />
      <div class="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-cyan/[0.06] blur-3xl" />
      <div class="absolute inset-0 bg-gradient-to-b from-dark/60 via-transparent to-dark" />
    </div>

    <main class="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div class="w-full max-w-md">
        <div class="mb-8 flex justify-center">
          <NuxtLink
            to="/login"
            class="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
            aria-label="Zeno House — Đăng nhập"
          >
            <IconLogo class="h-8 w-auto text-white" aria-hidden="true" />
          </NuxtLink>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-mesh {
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse 65% 55% at 50% 40%, black 0%, transparent 78%);
  mask-image: radial-gradient(ellipse 65% 55% at 50% 40%, black 0%, transparent 78%);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }
}
</style>
