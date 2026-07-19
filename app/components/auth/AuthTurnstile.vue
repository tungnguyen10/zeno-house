<script setup lang="ts">
const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ (event: 'verified', token: string | null): void }>()

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

const container = ref<HTMLElement | null>(null)
const error = ref(false)
let widgetId: string | null = null

function api(): TurnstileApi | undefined {
  return (window as typeof window & { turnstile?: TurnstileApi }).turnstile
}

function renderWidget() {
  if (!container.value || widgetId || !api()) return
  widgetId = api()!.render(container.value, {
    sitekey: props.siteKey,
    theme: 'dark',
    size: 'flexible',
    callback: (token: string) => { error.value = false; emit('verified', token) },
    'expired-callback': () => emit('verified', null),
    'error-callback': () => { error.value = true; emit('verified', null) },
  })
}

onMounted(() => {
  const existing = document.querySelector<HTMLScriptElement>('script[data-zeno-turnstile]')
  if (existing) {
    if (api()) renderWidget()
    else existing.addEventListener('load', renderWidget, { once: true })
    return
  }
  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.dataset.zenoTurnstile = 'true'
  script.addEventListener('load', renderWidget, { once: true })
  script.addEventListener('error', () => { error.value = true }, { once: true })
  document.head.appendChild(script)
})

onUnmounted(() => {
  if (widgetId) api()?.remove(widgetId)
})
</script>

<template>
  <div>
    <div ref="container" class="min-h-[65px] overflow-hidden rounded-lg" aria-label="Xác minh chống spam" />
    <p v-if="error" class="mt-1 text-xs text-error" role="alert">Không thể tải bước xác minh. Hãy tải lại trang.</p>
  </div>
</template>
