<template>
  <div class="min-h-screen bg-dark text-white lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(27rem,0.9fr)]">
    <aside class="relative overflow-hidden border-b border-dark-border bg-dark-card lg:min-h-screen lg:border-b-0 lg:border-r">
      <!-- Ambient depth: restrained cyan glow, static (reduced-motion safe) -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
        <div class="absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-cyan/5 blur-3xl" />
        <div class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cyan/5 to-transparent" />
      </div>

      <div class="relative z-10 flex h-full flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <NuxtLink to="/login" class="inline-flex w-fit items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40" aria-label="Zeno House — Đăng nhập">
          <IconLogo class="h-8 w-auto text-white lg:h-9" aria-hidden="true" />
        </NuxtLink>

        <div class="flex flex-1 flex-col justify-center gap-8">
          <div class="relative z-10 max-w-lg">
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-cyan">Không gian vận hành</p>
            <h1 class="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl lg:mt-3 lg:text-3xl">
              Một nơi cho toàn bộ vận hành tòa nhà.
            </h1>
            <p class="mt-3 hidden max-w-md text-sm leading-6 text-muted sm:block">
              Theo dõi phòng, hợp đồng, hóa đơn và công việc hằng tháng trong một nhịp rõ ràng.
            </p>
          </div>
          <img
            src="/images/auth-operations.png"
            alt=""
            aria-hidden="true"
            class="hidden w-full max-w-xl sm:block lg:max-h-[26rem] lg:object-contain"
          >
        </div>

        <div class="hidden flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted lg:flex">
          <span>Phòng</span>
          <span class="text-dark-border" aria-hidden="true">·</span>
          <span>Hợp đồng</span>
          <span class="text-dark-border" aria-hidden="true">·</span>
          <span>Hoá đơn</span>
          <span class="text-dark-border" aria-hidden="true">·</span>
          <span>Báo cáo vận hành</span>
        </div>
      </div>
    </aside>

    <main class="flex min-h-[60vh] items-center justify-center px-4 py-10 sm:px-8 sm:py-12 lg:min-h-screen lg:px-12">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }
}
</style>
