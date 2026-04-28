<template>
  <UCard v-if="success" class="w-full max-w-sm">
    <template #header>
      <h1 class="text-xl font-bold text-center text-[--color-title]">{{ $t("auth.reset_sent") }}</h1>
    </template>
    <p class="text-center text-sm text-[--color-body]">
      {{ $t("auth.reset_sent_description") }}
    </p>
    <template #footer>
      <NuxtLink to="/login" class="text-sm text-center block text-primary hover:underline">
        {{ $t("auth.back_to_login") }}
      </NuxtLink>
    </template>
  </UCard>

  <UCard v-else class="w-full max-w-sm">
    <template #header>
      <h1 class="text-xl font-bold text-center text-[--color-title]">{{ $t("auth.forgot_password_title") }}</h1>
      <p class="text-sm text-center text-[--color-body] mt-1">{{ $t("auth.forgot_password_description") }}</p>
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

      <UAlert v-if="error" color="error" :description="error" />

      <UButton type="submit" class="w-full justify-center" :loading="loading">
        {{ $t("auth.send_reset_link") }}
      </UButton>
    </UForm>

    <template #footer>
      <NuxtLink to="/login" class="text-sm text-center block text-primary hover:underline">
        {{ $t("auth.back_to_login") }}
      </NuxtLink>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { z } from "zod";

defineProps<{
  loading?: boolean;
  error?: string;
  success?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", payload: { email: string }): void;
}>();

const form = reactive({ email: "" });

const schema = z.object({
  email: z.string().email(),
});

function onSubmit() {
  emit("submit", { email: form.email });
}
</script>
