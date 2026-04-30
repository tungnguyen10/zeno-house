<script setup lang="ts">
definePageMeta({ layout: false });

const authStore = useAuthStore();
const user = useSupabaseUser();

const role = computed(() => authStore.role);
const isLoggedIn = computed(() => !!user.value && !!role.value);

if (user.value && !role.value) {
  await authStore.fetchRole();
}

const dashboardPath = computed(() => {
  if (role.value === "tenant") return "/tenant";
  if (role.value === "admin" || role.value === "manager") return "/app";
  return "/login";
});

const features = [
  { icon: "IconBuilding", label: "Quản lý tòa nhà & phòng" },
  { icon: "IconFileText", label: "Hợp đồng & hóa đơn" },
  { icon: "IconUsers", label: "Quản lý khách thuê" },
];
</script>

<template>
  <div class="flex min-h-screen flex-col bg-[--color-dark-nav]">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 sm:px-10">
      <div class="flex items-center gap-2">
        <IconLogo class="size-7 text-[--color-brand]" />
        <span class="text-lg font-bold tracking-tight text-white">Zeno House</span>
      </div>

      <div v-if="isLoggedIn" class="flex items-center gap-3">
        <span class="hidden text-sm text-white/60 sm:block">
          {{ authStore.profile?.full_name ?? authStore.profile?.email }}
        </span>
        <UButton :to="dashboardPath" color="primary" size="sm">
          {{ $t("navigation.landing.goToDashboard") }}
          <IconArrowRight class="size-4" />
        </UButton>
      </div>
      <UButton v-else to="/login" variant="ghost" class="text-white hover:text-white/80" size="sm">
        {{ $t("auth.login") }}
      </UButton>
    </header>

    <!-- Hero -->
    <main class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
      <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60">
        <span class="size-1.5 rounded-full bg-[--color-brand]" />
        Hệ thống quản lý nhà trọ
      </div>

      <h1 class="mb-4 max-w-2xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
        Quản lý nhà trọ
        <span class="block text-[--color-brand]">đơn giản hơn</span>
      </h1>

      <p class="mb-10 max-w-lg text-base leading-relaxed text-white/50 sm:text-lg">
        Quản lý phòng, hợp đồng, hóa đơn và khách thuê — tất cả trong một nền tảng.
      </p>

      <!-- Feature pills -->
      <div class="mb-12 flex flex-wrap justify-center gap-3">
        <div
          v-for="f in features"
          :key="f.label"
          class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
        >
          <component :is="f.icon" class="size-4 text-[--color-brand]" />
          {{ f.label }}
        </div>
      </div>

      <!-- CTA -->
      <div v-if="isLoggedIn" class="flex flex-col items-center gap-3">
        <p class="text-sm text-white/40">
          Đăng nhập với tài khoản
          <span class="font-medium text-white/70">{{ authStore.profile?.email }}</span>
        </p>
        <UButton :to="dashboardPath" color="primary" size="lg" class="px-8">
          Vào trang quản lý
          <IconArrowRight class="size-4" />
        </UButton>
      </div>

      <div v-else class="flex flex-col items-center gap-3 sm:flex-row">
        <UButton to="/login" color="primary" size="lg" class="px-8">
          {{ $t("auth.login") }}
          <IconArrowRight class="size-4" />
        </UButton>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 px-6 py-4 text-center text-xs text-white/30 sm:px-10">
      © {{ new Date().getFullYear() }} Zeno House
    </footer>
  </div>
</template>
