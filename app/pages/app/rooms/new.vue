<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const toast = useToast();
const { createRoom } = useRooms();
const saving = ref(false);

async function onSubmit(data: Parameters<typeof createRoom>[0]) {
  saving.value = true;
  try {
    await createRoom(data);
    toast.add({ title: t("common.success"), color: "success" });
    await navigateTo("/app/rooms");
  } catch {
    toast.add({ title: t("common.error"), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink
        to="/app/rooms"
        class="mb-1 flex items-center gap-1 text-sm text-[--color-body] hover:text-[--color-title]"
      >
        <IconChevronLeft class="size-4" />
        {{ t("navigation.sidebar.rooms") }}
      </NuxtLink>
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("rooms.form.create_title") }}</h1>
    </div>

    <UCard class="max-w-2xl">
      <RoomForm :loading="saving" @submit="onSubmit" @cancel="navigateTo('/app/rooms')" />
    </UCard>
  </div>
</template>
