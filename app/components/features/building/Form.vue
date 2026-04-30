<script setup lang="ts">
import { z } from "zod";
import type { Building } from "~/types/buildings";

const props = defineProps<{
  initial?: Partial<Building>;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", data: FormSchema): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const schema = z.object({
  name: z.string().min(1, t("validation.required")),
  address: z.string().min(1, t("validation.required")),
  description: z.string().optional(),
  total_floors: z.number().int().min(1).max(200),
});

type FormSchema = z.output<typeof schema>;

const state = reactive<Partial<FormSchema>>({
  name: props.initial?.name ?? "",
  address: props.initial?.address ?? "",
  description: props.initial?.description ?? "",
  total_floors: props.initial?.total_floors ?? 1,
});

async function onSubmit(data: FormSchema) {
  emit("submit", data);
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField :label="t('buildings.detail.name')" name="name" required>
      <UInput
        v-model="state.name"
        :placeholder="t('buildings.form.name_placeholder')"
        class="w-full"
      />
    </UFormField>

    <UFormField :label="t('buildings.detail.address')" name="address" required>
      <UInput
        v-model="state.address"
        :placeholder="t('buildings.form.address_placeholder')"
        class="w-full"
      />
    </UFormField>

    <UFormField :label="t('buildings.detail.total_floors')" name="total_floors">
      <UInput
        v-model.number="state.total_floors"
        type="number"
        :min="1"
        :max="200"
        :placeholder="t('buildings.form.total_floors_placeholder')"
        class="w-full"
      />
    </UFormField>

    <UFormField :label="t('buildings.detail.description')" name="description">
      <UTextarea
        v-model="state.description"
        :placeholder="t('buildings.form.description_placeholder')"
        :rows="3"
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end gap-3 pt-2">
      <UButton type="button" color="neutral" variant="ghost" @click="emit('cancel')">
        {{ t("actions.cancel") }}
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ t("actions.save") }}
      </UButton>
    </div>
  </UForm>
</template>
