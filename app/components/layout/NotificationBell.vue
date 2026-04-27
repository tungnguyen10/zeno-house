<script setup lang="ts">
const { unreadCount } = storeToRefs(useNotificationsStore());
</script>

<template>
  <UChip :text="unreadCount > 0 ? String(unreadCount) : undefined" size="sm">
    <UButton
      variant="ghost"
      color="neutral"
      aria-label="Notifications"
    >
      <IconBell class="size-5" />
    </UButton>
  </UChip>
</template>
