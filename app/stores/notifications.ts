export const useNotificationsStore = defineStore("notifications", () => {
  const unreadCount = ref(0);

  function $reset() {
    unreadCount.value = 0;
  }

  return { unreadCount, $reset };
});
