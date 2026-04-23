import type { Role, Profile } from "~/types";

type AuthUser = { id: string; email: string | undefined };

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const profile = ref<Profile | null>(null);
  const role = computed(() => profile.value?.role ?? null);

  async function fetchProfile() {
    if (profile.value) return;
    const data = await $fetch<{
      id: string;
      email?: string;
      role: string | null;
      full_name: string | null;
      created_at: string;
    }>("/api/auth/me").catch(() => null);
    if (data?.role) {
      user.value = { id: data.id, email: data.email };
      profile.value = {
        id: data.id,
        email: data.email ?? "",
        role: data.role as Role,
        full_name: data.full_name,
        created_at: data.created_at,
      };
    }
  }

  async function fetchRole() {
    if (role.value) return role.value;
    await fetchProfile();
    return role.value;
  }

  function setProfile(data: Profile) {
    profile.value = data;
    user.value = { id: data.id, email: data.email };
  }

  function $reset() {
    user.value = null;
    profile.value = null;
  }

  function clearRole() {
    $reset();
  }

  return { user, profile, role, fetchProfile, fetchRole, setProfile, $reset, clearRole };
});
