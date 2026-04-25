<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <h1 class="text-xl font-bold text-center">{{ $t("app_name") }}</h1>
      <p class="text-sm text-center text-gray-500 mt-1">
        {{ variant === "tenant" ? $t("auth.tenant_portal") : $t("auth.admin_portal") }}
      </p>
    </template>

    <UForm :schema="schema" :state="form" class="space-y-4" @submit="onSubmit">
      <UFormField :label="$t('auth.email')" name="email">
        <UInput
          v-model="form.email"
          type="email"
          :placeholder="$t('auth.email_placeholder')"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="$t('auth.password')" name="password">
        <UInput
          v-model="form.password"
          type="password"
          :placeholder="$t('auth.password_placeholder')"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UAlert v-if="error" color="error" :description="error" />

      <UButton type="submit" class="w-full justify-center" :loading="loading">
        {{ $t("auth.login") }}
      </UButton>

      <UDivider :label="$t('auth.or')" />

      <UButton
        variant="outline"
        class="w-full justify-center"
        :loading="googleLoading"
        @click="$emit('google')"
      >
        <template #leading>
          <IconGoogle class="w-4 h-4" />
        </template>
        {{ $t("auth.login_with_google") }}
      </UButton>
    </UForm>

    <template #footer>
      <NuxtLink to="/forgot-password" class="text-sm text-center block text-primary hover:underline">
        {{ $t("auth.forgot_password") }}
      </NuxtLink>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { z } from "zod";

defineProps<{
  variant?: "admin" | "tenant";
  loading?: boolean;
  googleLoading?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: "submit", payload: { email: string; password: string }): void;
  (e: "google"): void;
}>();

const form = reactive({ email: "", password: "" });

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function onSubmit() {
  emit("submit", { email: form.email, password: form.password });
}
</script>
