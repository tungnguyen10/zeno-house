export const useUiStore = defineStore("ui", () => {
  const sidebarOpen = ref(false);

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function closeSidebar() {
    sidebarOpen.value = false;
  }

  function $reset() {
    sidebarOpen.value = false;
  }

  return { sidebarOpen, toggleSidebar, closeSidebar, $reset };
});
