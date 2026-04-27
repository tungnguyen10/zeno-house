export function useLogout() {
  const authStore = useAuthStore();
  const supabase = useSupabaseClient();

  async function logout() {
    authStore.$reset();
    await supabase.auth.signOut();
    await navigateTo("/login");
  }

  return { logout };
}
