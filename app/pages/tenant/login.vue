<template>
  <AuthLoginForm variant="tenant" :loading="loading" :google-loading="googleLoading" :error="error" @submit="handleSubmit" @google="handleGoogle" />
</template>

<script setup lang="ts">
definePageMeta({ layout: "auth", middleware: ["guest"] });

const { login, loginWithGoogle, signOut, isTenant } = useAuth();
const { t } = useI18n();

const loading = ref(false);
const googleLoading = ref(false);
const error = ref("");

async function handleGoogle() {
  googleLoading.value = true;
  error.value = "";
  try {
    await loginWithGoogle();
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("auth.login_failed");
    googleLoading.value = false;
  }
}
async function handleSubmit({ email, password }: { email: string; password: string }) {
  loading.value = true;
  error.value = "";
  try {
    await login(email, password);
    if (!isTenant.value) {
      await signOut();
      error.value = t("auth.errors.wrong_role");
      return;
    }
    await navigateTo("/tenant");
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("auth.login_failed");
  } finally {
    loading.value = false;
  }
}
</script>
