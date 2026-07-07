// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: true },

  devServer: {
    https: true,
  },

  modules: [
    "@pinia/nuxt",
    "nuxt-svgo",
    "@nuxt/eslint",
    "@nuxtjs/tailwindcss",
    "@nuxtjs/supabase",
  ],

  tailwindcss: {
    cssPath: "~/assets/scss/main.scss",
  },

  // Runtime config — NUXT_* env vars are auto-mapped
  runtimeConfig: {
    resendApiKey: "", // RESEND_API_KEY
    adminEmail: "", // ADMIN_EMAIL
    turnstileSecretKey: "", // NUXT_TURNSTILE_SECRET_KEY
    operationsReportAutoCloseSecret: "", // NUXT_OPERATIONS_REPORT_AUTO_CLOSE_SECRET
    public: {
      siteUrl: "", // NUXT_PUBLIC_SITE_URL
      gaId: "", // NUXT_PUBLIC_GA_ID
      turnstileSiteKey: "", // NUXT_PUBLIC_TURNSTILE_SITE_KEY
      // Feature flag: one-click auto-issue ("Đã thu") on draft rows. Public so
      // the client can gate the row action; default off until staging-verified.
      billingAutoIssueEnabled: false, // NUXT_PUBLIC_BILLING_AUTO_ISSUE_ENABLED
    },
  },

  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      title: "Zeno House",
      titleTemplate: "%s | Zeno House",
      meta: [
        {
          name: "description",
          content: "Zeno House - Hệ thống quản lý bất động sản",
        },
        { name: "theme-color", content: "#ffffff" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Zeno House" },
        { property: "og:locale", content: "vi_VN" },
        { name: "robots", content: "index, follow" },
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      "55 16 * * *": ["operations-report:auto-close"],
    },
  },

  // Auto-import composables từ tất cả subdirectories
  imports: {
    dirs: ['composables/**'],
  },

  // Components dùng filename làm tên (không prefix directory)
  components: [
    { path: '~/components', pathPrefix: false },
  ],

  svgo: {
    autoImportPath: "./assets/icons/",
    defaultImport: "component",
    componentPrefix: "Icon",
  },
  supabase: {
    redirect: false,
  },
});
