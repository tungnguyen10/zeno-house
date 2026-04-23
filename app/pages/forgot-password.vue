<template>
  <AuthForgotPasswordForm :loading="loading" :error="error" :success="success" @submit="handleSubmit" />
</template>

<script setup lang="ts">
definePageMeta({ layout: "auth", middleware: ["guest"] });

const { forgotPassword } = useAuth();
const { t } = useI18n();

const loading = ref(false);
const error = ref("");
const success = ref(false);

async function handleSubmit({ email }: { email: string }) {
  loading.value = true;
  error.value = "";
  try {
    await forgotPassword(email);
    success.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("auth.login_failed");
  } finally {
    loading.value = false;
  }
}
</script>
