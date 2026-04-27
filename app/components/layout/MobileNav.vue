<script setup lang="ts">
const uiStore = useUiStore();
const { sidebarOpen } = storeToRefs(uiStore);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 md:hidden"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          aria-hidden="true"
          @click="uiStore.closeSidebar()"
        />

        <!-- Sidebar panel -->
        <Transition
          enter-active-class="transition-transform duration-300 ease-out"
          enter-from-class="-translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition-transform duration-200 ease-in"
          leave-from-class="translate-x-0"
          leave-to-class="-translate-x-full"
        >
          <div
            v-if="sidebarOpen"
            class="relative z-50 h-full w-64"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <UButton
              class="absolute right-2 top-3 z-10"
              variant="ghost"
              color="neutral"
              aria-label="Close menu"
              @click="uiStore.closeSidebar()"
            >
              <IconX class="size-5" />
            </UButton>
            <LayoutSidebar />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
