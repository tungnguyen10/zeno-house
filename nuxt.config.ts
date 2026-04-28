// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'vi' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
    },
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    'nuxt-svgo',
  ],

  i18n: {
    locales: [
      {
        code: 'vi',
        language: 'vi-VN',
        name: 'Tiếng Việt',
        files: [
          'vi/common.json',
          'vi/auth.json',
          'vi/navigation.json',
          'vi/buildings.json',
          'vi/rooms.json',
          'vi/tenants.json',
          'vi/contracts.json',
          'vi/invoices.json',
          'vi/utilities.json',
        ],
      },
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        files: [
          'en/common.json',
          'en/auth.json',
          'en/navigation.json',
          'en/buildings.json',
          'en/rooms.json',
          'en/tenants.json',
          'en/contracts.json',
          'en/invoices.json',
          'en/utilities.json',
        ],
      },
    ],
    defaultLocale: 'vi',
    langDir: 'locales/',
    strategy: 'prefix_except_default',
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    serviceKey: process.env.SUPABASE_SECRET_KEY,
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/auth/callback',
      exclude: ['/login', '/tenant/login', '/forgot-password', '/auth/callback'],
    },
  },

  runtimeConfig: {
    supabaseServiceKey: process.env.SUPABASE_SECRET_KEY ?? '',
  },

  colorMode: {
    classSuffix: '',
  },

  typescript: {
    strict: true,
  },

  devServer: {
    https: true,
  },
  svgo: {
    autoImportPath: "~/assets/icons",
    componentPrefix: "icon",
  },
  imports: {
    dirs: ["stores"],
  },
  pinia: {
    storesDirs: ["./stores/**"],
  },
  vite: {
    optimizeDeps: {
      include: ['zod'],
    },
  },
})
