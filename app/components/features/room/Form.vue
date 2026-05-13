<script setup lang="ts">
import { z } from "zod";
import { createRoomSchema } from "~/types/rooms";
import type { Room } from "~/types/rooms";

const props = defineProps<{
  initial?: Partial<Room>;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", data: FormSchema): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const schema = createRoomSchema;
type FormSchema = z.output<typeof schema>;

const statusOptions = (["available", "occupied", "maintenance", "reserved"] as const).map((s) => ({
  label: t(`rooms.status.${s}`),
  value: s,
}));

const state = reactive<Partial<FormSchema>>({
  building_id: props.initial?.building_id ?? "",
  room_number: props.initial?.room_number ?? "",
  floor: props.initial?.floor ?? undefined,
  area: props.initial?.area ?? undefined,
  base_price: props.initial?.base_price ?? undefined,
  deposit_amount: props.initial?.deposit_amount ?? 0,
  max_occupants: props.initial?.max_occupants ?? 1,
  status: props.initial?.status ?? "available",
  description: props.initial?.description ?? undefined,
});

async function onSubmit(event: { data: FormSchema }) {
  emit("submit", event.data);
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField :label="t('rooms.columns.building')" name="building_id" required>
      <BuildingSelect v-model="state.building_id" class="w-full" />
    </UFormField>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField :label="t('rooms.detail.room_number')" name="room_number" required>
        <UInput
          v-model="state.room_number"
          :placeholder="t('rooms.form.room_number_placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('rooms.detail.floor')" name="floor">
        <UInput
          v-model.number="state.floor"
          type="number"
          :min="0"
          :placeholder="t('rooms.form.floor_placeholder')"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField :label="t('rooms.detail.base_price')" name="base_price" required>
        <UInput
          v-model.number="state.base_price"
          type="number"
          :min="0"
          :placeholder="t('rooms.form.base_price_placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('rooms.detail.deposit_amount')" name="deposit_amount">
        <UInput
          v-model.number="state.deposit_amount"
          type="number"
          :min="0"
          :placeholder="t('rooms.form.deposit_amount_placeholder')"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField :label="t('rooms.detail.area')" name="area">
        <UInput
          v-model.number="state.area"
          type="number"
          :min="0"
          :placeholder="t('rooms.form.area_placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('rooms.detail.max_occupants')" name="max_occupants">
        <UInput
          v-model.number="state.max_occupants"
          type="number"
          :min="1"
          :placeholder="t('rooms.form.max_occupants_placeholder')"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField :label="t('rooms.columns.status')" name="status">
      <USelect v-model="state.status" :options="statusOptions" class="w-full" />
    </UFormField>

    <UFormField :label="t('rooms.detail.description')" name="description">
      <UTextarea
        v-model="state.description"
        :placeholder="t('rooms.form.description_placeholder')"
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
