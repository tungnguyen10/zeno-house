<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <h1 class="text-xl font-bold text-center">{{ $t("auth.reset_password_title") }}</h1>
      <p class="text-sm text-center text-gray-500 mt-1">{{ $t("auth.reset_password_description") }}</p>
    </template>

    <UForm :schema="schema" :state="form" class="space-y-4" @submit="onSubmit">
      <UFormField :label="$t('auth.new_password')" name="password">
        <UInput
          v-model="form.password"
          type="password"
          :placeholder="$t('auth.new_password_placeholder')"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="$t('auth.confirm_password')" name="confirm">
        <UInput
          v-model="form.confirm"
          type="password"
          :placeholder="$t('auth.confirm_password_placeholder')"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UAlert v-if="error" color="error" :description="error" />

      <UButton type="submit" class="w-full justify-center" :loading="loading">
        {{ $t("auth.update_password") }}
      </UButton>
    </UForm>
  </UCard>
</template>

<script setup lang="ts">
import { z } from "zod";

const { t } = useI18n();

defineProps<{
  loading?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: "submit", payload: { password: string }): void;
}>();

const form = reactive({ password: "", confirm: "" });

const schema = z
  .object({
    password: z.string().min(6, t("auth.errors.password_too_short")),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: t("auth.errors.password_mismatch"),
    path: ["confirm"],
  });

function onSubmit() {
  emit("submit", { password: form.password });
}
</script>
