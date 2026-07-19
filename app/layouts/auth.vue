<template>
  <div class="min-h-screen bg-dark text-white lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,0.9fr)]">
    <aside class="relative overflow-hidden border-b border-dark-border bg-dark-card lg:min-h-screen lg:border-b-0 lg:border-r">
      <div class="relative z-10 flex h-full flex-col px-5 py-5 sm:px-8 lg:px-12 lg:py-10">
        <NuxtLink to="/login" class="inline-flex w-fit items-center" aria-label="Zeno House — Đăng nhập">
          <IconLogo class="h-8 w-auto text-white lg:h-9" aria-hidden="true" />
        </NuxtLink>

        <div class="relative mt-5 grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_15rem] lg:mt-auto lg:block">
          <div class="relative z-10 max-w-lg pr-16 sm:pr-0">
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-cyan">Không gian vận hành</p>
            <h1 class="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl lg:mt-3 lg:text-3xl">
              Một nơi cho toàn bộ vận hành tòa nhà.
            </h1>
            <p class="mt-2 max-w-md text-sm leading-6 text-muted lg:mt-3">
              Theo dõi phòng, hợp đồng, hóa đơn và công việc hằng tháng trong một nhịp rõ ràng.
            </p>
          </div>
          <img
            src="/images/auth-operations.svg"
            alt=""
            aria-hidden="true"
            class="absolute -right-8 top-0 w-40 opacity-25 sm:static sm:block sm:w-full sm:opacity-100 lg:mt-8 lg:max-h-[30rem] lg:object-contain"
          >
        </div>
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cyan/5 to-transparent" aria-hidden="true" />
    </aside>

    <main class="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-8 sm:px-8 lg:min-h-screen lg:px-12">
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
