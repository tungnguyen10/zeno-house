<script setup lang="ts">
import { getRedirectByRole } from '~/utils/auth-redirect'

definePageMeta({ layout: false })

const user = useSupabaseUser()
const role = user.value?.app_metadata?.role as string | null | undefined

if (user.value) {
  await navigateTo(getRedirectByRole(role), { replace: true })
}

const siteUrl = useRuntimeConfig().public.siteUrl || 'http://localhost:3000'
const pageTitle = 'Phần mềm quản lý nhà cho thuê | Zeno House'
const pageDescription = 'Zeno House giúp chủ nhà và đội vận hành quản lý tòa nhà, phòng, khách thuê, hợp đồng và hóa đơn trên một nền tảng.'
const faqItems = [
  {
    question: 'Zeno House là gì?',
    answer: 'Zeno House là phần mềm quản lý bất động sản dành cho chủ nhà và đội vận hành nhà cho thuê, tập trung vào dữ liệu phòng, khách thuê, hợp đồng và hóa đơn.',
  },
  {
    question: 'Zeno House quản lý được những gì?',
    answer: 'Zeno House hỗ trợ quản lý tòa nhà, phòng, khách thuê, hợp đồng, dịch vụ, chỉ số điện nước, kỳ thu tiền và hóa đơn.',
  },
  {
    question: 'Zeno House phù hợp với ai?',
    answer: 'Sản phẩm phù hợp với chủ nhà, người quản lý tòa nhà và đội vận hành cần một quy trình tập trung, dễ kiểm tra và có lịch sử thao tác rõ ràng.',
  },
]

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: siteUrl,
  twitterCard: 'summary',
  robots: 'index, follow',
})

useHead({
  link: [{ rel: 'canonical', href: siteUrl }],
  script: [
    {
      type: 'application/ld+json',
      textContent: JSON.stringify([
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Zeno House',
          url: siteUrl,
          description: pageDescription,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Zeno House',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: siteUrl,
          description: pageDescription,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map(item => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        },
      ]),
    },
  ],
})
</script>

<template>
  <main class="min-h-screen bg-ui-canvas text-ui-primary">
    <section class="border-b border-ui-border bg-ui-deep">
      <div class="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <nav class="flex items-center justify-between" aria-label="Điều hướng chính">
          <NuxtLink to="/" class="flex items-center gap-3 text-sm font-semibold text-white" aria-label="Zeno House - Trang chủ">
            <IconLogo class="h-7 w-auto" aria-hidden="true" />
            <span>Zeno House</span>
          </NuxtLink>
          <NuxtLink
            to="/login"
            class="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/50"
          >
            Đăng nhập
          </NuxtLink>
        </nav>

        <div class="max-w-3xl py-20 sm:py-28">
          <p class="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-ui-accent">Quản lý nhà cho thuê</p>
          <h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Vận hành tòa nhà rõ ràng hơn, mỗi ngày.
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Zeno House tập trung tòa nhà, phòng, khách thuê, hợp đồng và hóa đơn vào một quy trình dễ theo dõi cho chủ nhà và đội vận hành.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink
              to="/register"
              class="rounded-md bg-ui-accent px-5 py-3 text-sm font-semibold text-ui-on-accent transition-colors hover:bg-ui-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/50"
            >
              Bắt đầu sử dụng
            </NuxtLink>
            <a
              href="#faq"
              class="rounded-md border border-white/20 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/50"
            >
              Xem câu hỏi thường gặp
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-10" aria-labelledby="capabilities-title">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-ui-accent">Một nguồn dữ liệu vận hành</p>
        <h2 id="capabilities-title" class="mt-3 text-2xl font-semibold sm:text-3xl">Từ phòng trống đến kỳ thu tiền, mọi việc ở đúng chỗ.</h2>
      </div>
      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article v-for="item in ['Tòa nhà và phòng', 'Khách thuê và hợp đồng', 'Dịch vụ và chỉ số', 'Hóa đơn và thu tiền']" :key="item" class="rounded-xl border border-ui-border bg-ui-surface p-5">
          <h3 class="text-base font-semibold">{{ item }}</h3>
          <p class="mt-2 text-sm leading-6 text-ui-muted">Theo dõi thông tin vận hành và trạng thái công việc trong cùng một hệ thống.</p>
        </article>
      </div>
    </section>

    <section id="faq" class="border-t border-ui-border bg-ui-surface" aria-labelledby="faq-title">
      <div class="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-10">
        <h2 id="faq-title" class="text-2xl font-semibold sm:text-3xl">Câu hỏi thường gặp</h2>
        <div class="mt-8 max-w-3xl divide-y divide-ui-border">
          <details v-for="item in faqItems" :key="item.question" class="py-5">
            <summary class="cursor-pointer text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/50">{{ item.question }}</summary>
            <p class="mt-3 max-w-2xl text-sm leading-7 text-ui-muted">{{ item.answer }}</p>
          </details>
        </div>
      </div>
    </section>

    <footer class="border-t border-ui-border px-5 py-8 text-sm text-ui-muted sm:px-8 lg:px-10">
      <div class="mx-auto max-w-6xl">Zeno House · Phần mềm quản lý bất động sản trên nền tảng web</div>
    </footer>
  </main>
</template>
