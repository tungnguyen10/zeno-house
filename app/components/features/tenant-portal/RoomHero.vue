<script setup lang="ts">
interface RoomHeroData {
  room_number: string;
  building_name: string;
  floor: number | null;
  contract_start_date: string;
  contract_end_date: string;
}

const props = defineProps<{
  room: RoomHeroData | null;
  loading?: boolean;
}>();

const remainingDays = computed(() => {
  if (!props.room) return 0;
  const end = new Date(props.room.contract_end_date);
  const today = new Date();
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
});

const totalDays = computed(() => {
  if (!props.room) return 1;
  const start = new Date(props.room.contract_start_date);
  const end = new Date(props.room.contract_end_date);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
});

const usedPercent = computed(() =>
  Math.min(100, Math.round(((totalDays.value - remainingDays.value) / totalDays.value) * 100)),
);

const progressColor = computed(() => {
  if (remainingDays.value <= 7) return "bg-[--color-error]";
  if (remainingDays.value <= 30) return "bg-[--color-warning]";
  return "bg-[--color-theme]";
});
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loading" class="space-y-3 rounded-2xl bg-[--color-bg-surface] p-5 shadow-sm ring-1 ring-[--color-border]">
    <USkeleton class="h-5 w-1/3" />
    <USkeleton class="h-8 w-1/2" />
    <USkeleton class="h-2 w-full rounded-full" />
    <div class="flex gap-3 pt-1">
      <USkeleton class="h-9 flex-1 rounded-lg" />
      <USkeleton class="h-9 flex-1 rounded-lg" />
    </div>
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!room"
    class="flex flex-col items-center justify-center rounded-2xl bg-[--color-bg-surface] py-10 text-center ring-1 ring-[--color-border]"
  >
    <div class="mb-3 flex size-12 items-center justify-center rounded-full bg-[--color-bg-muted]">
      <IconHome class="size-6 text-[--color-body]" />
    </div>
    <p class="text-sm font-medium text-[--color-title]">Chưa có phòng</p>
    <p class="mt-1 text-xs text-[--color-body]">Liên hệ chủ nhà để được phân phòng</p>
  </div>

  <!-- Hero card -->
  <div
    v-else
    class="rounded-2xl bg-[--color-bg-surface] p-5 shadow-sm ring-1 ring-[--color-border]"
  >
    <!-- Room info -->
    <div class="mb-4">
      <p class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
        {{ room.building_name }}
        <span v-if="room.floor"> · Tầng {{ room.floor }}</span>
      </p>
      <p class="mt-0.5 text-2xl font-bold text-[--color-title]">
        Phòng {{ room.room_number }}
      </p>
    </div>

    <!-- Countdown -->
    <div class="mb-4 space-y-1.5">
      <div class="flex items-center justify-between text-xs text-[--color-body]">
        <span>Thời hạn hợp đồng</span>
        <span
          :class="cn(
            'font-semibold',
            remainingDays <= 7 ? 'text-[--color-error]' :
            remainingDays <= 30 ? 'text-[--color-warning]' :
            'text-[--color-title]',
          )"
        >
          {{ remainingDays }} ngày còn lại
        </span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-[--color-bg-muted]">
        <div
          :class="cn('h-full rounded-full transition-all', progressColor)"
          :style="{ width: `${usedPercent}%` }"
        />
      </div>
    </div>

    <!-- CTAs -->
    <div class="flex gap-3">
      <UButton
        to="/tenant/maintenance"
        variant="outline"
        color="neutral"
        class="flex-1"
        size="sm"
      >
        <IconWrench class="size-4" />
        Yêu cầu bảo trì
      </UButton>
      <UButton
        to="/tenant/contracts"
        color="primary"
        class="flex-1"
        size="sm"
      >
        <IconFileText class="size-4" />
        Xem hợp đồng
      </UButton>
    </div>
  </div>
</template>
