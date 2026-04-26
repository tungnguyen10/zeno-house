<template>
  <div>
    <AuthResetPasswordForm
      v-if="!success"
      :loading="loading"
      :error="error ?? undefined"
      @submit="handleSubmit"
    />

    <UCard v-else class="w-full max-w-sm text-center">
      <template #header>
        <h1 class="text-xl font-bold">{{ $t("auth.password_updated") }}</h1>
      </template>
      <p class="text-sm text-gray-500">{{ $t("auth.password_updated_description") }}</p>
      <template #footer>
        <NuxtLink to="/login" class="text-sm text-primary hover:underline">
          {{ $t("auth.back_to_login") }}
        </NuxtLink>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const supabase = useSupabaseClient();
const { resetPassword } = useAuth();
const authStore = useAuthStore();
const route = useRoute();
const { t } = useI18n();

const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
let redirectTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    await navigateTo("/forgot-password");
    return;
  }

  // Supabase appends type=recovery to the URL when the user arrives via a password reset email.
  // If that param is absent, this is a regular authenticated user visiting the page directly —
  // redirect them to their dashboard instead of showing the reset form.
  if (route.query.type !== "recovery") {
    const role = authStore.role ?? await authStore.fetchRole();
    if (role === "admin") await navigateTo("/admin");
    else if (role === "manager") await navigateTo("/manager");
    else await navigateTo("/tenant");
  }
});

onUnmounted(() => {
  if (redirectTimer) clearTimeout(redirectTimer);
});

async function handleSubmit({ password }: { password: string }) {
  loading.value = true;
  error.value = null;
  try {
    await resetPassword(password);
    success.value = true;
    redirectTimer = setTimeout(() => navigateTo("/login"), 3000);
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("auth.errors.invalid_reset_link");
  } finally {
    loading.value = false;
  }
}
</script>
