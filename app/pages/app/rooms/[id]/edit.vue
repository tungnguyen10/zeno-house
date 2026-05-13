<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const id = route.params.id as string;

const { getRoom, updateRoom } = useRooms();
const room = ref(await getRoom(id));

if (!room.value) {
  await navigateTo("/app/rooms");
}

const saving = ref(false);

async function onSubmit(data: Parameters<typeof updateRoom>[1]) {
  saving.value = true;
  try {
    await updateRoom(id, data);
    toast.add({ title: t("common.success"), color: "success" });
    await navigateTo(`/app/rooms/${id}`);
  } catch {
    toast.add({ title: t("common.error"), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="room" class="space-y-6">
    <div>
      <NuxtLink
        :to="`/app/rooms/${id}`"
        class="mb-1 flex items-center gap-1 text-sm text-[--color-body] hover:text-[--color-title]"
      >
        <IconChevronLeft class="size-4" />
        {{ t("rooms.hero.room_label", { n: room.room_number }) }}
      </NuxtLink>
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("rooms.form.edit_title") }}</h1>
    </div>

    <UCard class="max-w-2xl">
      <RoomForm
        :initial="room"
        :loading="saving"
        @submit="onSubmit"
        @cancel="navigateTo(`/app/rooms/${id}`)"
      />
    </UCard>
  </div>
</template>
