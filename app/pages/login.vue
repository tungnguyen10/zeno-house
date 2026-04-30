<template>
  <AuthLoginForm :loading="loading" :google-loading="googleLoading" :error="error" @submit="handleSubmit" @google="handleGoogle" />
</template>

<script setup lang="ts">
definePageMeta({ layout: "auth", middleware: ["guest"] });

const { login, signOut, loginWithGoogle, isAdmin, isManager, isTenant } = useAuth();
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
    if (isTenant.value) {
      await signOut();
      error.value = t("auth.errors.wrong_role");
      return;
    }
    if (isAdmin.value || isManager.value) {
      await usePermissionsStore().loadPermissions();
      await navigateTo("/app");
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("auth.login_failed");
  } finally {
    loading.value = false;
  }
}
</script>
