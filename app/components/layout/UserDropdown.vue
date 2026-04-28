<script setup lang="ts">
const authStore = useAuthStore();
const { profile } = storeToRefs(authStore);
const { logout } = useLogout();
const { t } = useI18n();

const displayName = computed(
  () => profile.value?.full_name ?? profile.value?.email ?? "User",
);

const items = computed(() => [
  [
    {
      label: displayName.value,
      slot: "account",
      disabled: true,
    },
  ],
  [
    {
      label: t("navigation.user_menu.profile"),
      slot: "profile",
      to: "/profile",
    },
  ],
  [
    {
      label: t("navigation.user_menu.logout"),
      slot: "logout",
      color: "error" as const,
      onSelect: logout,
    },
  ],
]);
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      variant="ghost"
      color="neutral"
      class="gap-2"
      :aria-label="displayName"
    >
      <UAvatar
        :alt="displayName"
        size="xs"
      />
      <span class="hidden text-sm font-medium sm:block">{{ displayName }}</span>
      <IconChevronDown class="size-4" />
    </UButton>

    <template #item-profile="{ item }">
      <IconUser class="size-4 shrink-0" />
      <span>{{ item.label }}</span>
    </template>

    <template #item-logout="{ item }">
      <IconLogOut class="size-4 shrink-0 text-[--color-error]" />
      <span class="text-[--color-error]">{{ item.label }}</span>
    </template>
  </UDropdownMenu>
</template>
