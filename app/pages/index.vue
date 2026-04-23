<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const user = useSupabaseUser();
const authStore = useAuthStore();

if (!user.value) {
  await navigateTo("/login");
} else {
  const role = await authStore.fetchRole();
  if (role === "admin") await navigateTo("/admin");
  else if (role === "manager") await navigateTo("/manager");
  else await navigateTo("/tenant");
}
</script>

<template>
  <div />
</template>
