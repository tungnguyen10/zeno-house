<template>
  <div />
</template>

<script setup lang="ts">
import type { Role } from "~/types";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const authStore = useAuthStore();

onMounted(async () => {
  // @nuxtjs/supabase handles PKCE exchange automatically via the hash/query params.
  // Wait briefly for the session to be established, then read it.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    // Session not ready yet — listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s?.user) {
        subscription.unsubscribe();
        await handleSession(s.user.id, s.user.email);
      }
    });
    return;
  }

  await handleSession(session.user.id, session.user.email);
});

async function handleSession(userId: string, email: string | undefined) {
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, full_name, created_at")
    .eq("id", userId)
    .maybeSingle<{ role: string; full_name: string | null; created_at: string }>();

  if (profileData?.role) {
    authStore.setProfile({
      id: userId,
      email: email ?? "",
      role: profileData.role as Role,
      full_name: profileData.full_name,
      created_at: profileData.created_at,
    });

    if (profileData.role === "admin") await navigateTo("/admin");
    else if (profileData.role === "manager") await navigateTo("/manager");
    else await navigateTo("/tenant");
  } else {
    await supabase.auth.signOut();
    await navigateTo("/login");
  }
}
</script>
