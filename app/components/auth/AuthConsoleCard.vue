<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  eyebrow?: string
  subtitle?: string
  /** Short mono readout shown on the right of the status rail. */
  status?: string
}>(), {
  status: 'SẴN SÀNG',
})
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-dark-border bg-dark-surface/85 shadow-2xl backdrop-blur-md">
    <!-- Status rail: operational readout signature -->
    <div class="flex items-center gap-2 border-b border-dark-border/80 bg-dark-card/60 px-5 py-2.5 sm:px-6">
      <span class="flex items-center gap-1.5" aria-hidden="true">
        <span class="size-2 rounded-full bg-cyan shadow-[0_0_10px_rgba(0,229,255,0.55)]" />
        <span class="size-2 rounded-full bg-success-neon/80" />
        <span class="size-2 rounded-full bg-dark-border" />
      </span>
      <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">ZENO · HỆ VẬN HÀNH</span>
      <span class="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">{{ status }}</span>
    </div>

    <div class="p-5 sm:p-6">
      <div class="mb-6">
        <p v-if="eyebrow" class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">{{ eyebrow }}</p>
        <h1 class="mt-2 text-2xl font-semibold text-white">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 text-sm leading-6 text-muted">{{ subtitle }}</p>
      </div>
      <slot />
    </div>
  </section>
</template>
