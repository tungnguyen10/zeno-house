// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: process.env.NODE_ENV !== "production" },

  devServer: {
    https: true,
  },

  modules: [
    "@pinia/nuxt",
    "nuxt-svgo",
    "@nuxt/eslint",
    "@nuxtjs/tailwindcss",
    "@nuxtjs/supabase",
    "@vite-pwa/nuxt",
    "@vueuse/nuxt",
    "@nuxt/image",
  ],

  tailwindcss: {
    cssPath: "~/assets/scss/main.scss",
  },

  // Runtime config — NUXT_* env vars are auto-mapped
  runtimeConfig: {
    resendApiKey: process.env.NUXT_RESEND_API_KEY || "", // NUXT_RESEND_API_KEY
    resendFrom: process.env.NUXT_RESEND_FROM  || "", // NUXT_RESEND_FROM
    resendReplyTo: process.env.NUXT_RESEND_REPLY_TO || "", // NUXT_RESEND_REPLY_TO
    resendWebhookSecret: process.env.NUXT_RESEND_WEBHOOK_SECRET || "", // NUXT_RESEND_WEBHOOK_SECRET
    invoiceEmailDispatchSecret: process.env.NUXT_INVOICE_EMAIL_DISPATCH_SECRET || "", // NUXT_INVOICE_EMAIL_DISPATCH_SECRET
    aiProvider: process.env.NUXT_AI_PROVIDER || "openrouter", // NUXT_AI_PROVIDER (openrouter | google)
    aiOpenrouterApiKey: process.env.NUXT_AI_OPENROUTER_API_KEY || "", // NUXT_AI_OPENROUTER_API_KEY
    aiGoogleApiKey: process.env.NUXT_AI_GOOGLE_API_KEY || "", // NUXT_AI_GOOGLE_API_KEY
    aiModel: process.env.NUXT_AI_MODEL || "nvidia/nemotron-3-super-120b-a12b:free", // NUXT_AI_MODEL
    aiModelFallback: process.env.NUXT_AI_MODEL_FALLBACK || "google/gemma-4-31b-it:free", // NUXT_AI_MODEL_FALLBACK
    aiMaxSteps: process.env.NUXT_AI_MAX_STEPS ? parseInt(process.env.NUXT_AI_MAX_STEPS) : 8, // NUXT_AI_MAX_STEPS
    aiMaxOutputTokens: process.env.NUXT_AI_MAX_OUTPUT_TOKENS ? parseInt(process.env.NUXT_AI_MAX_OUTPUT_TOKENS) : 1200, // NUXT_AI_MAX_OUTPUT_TOKENS
    aiChatEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_CHAT_ENABLED
    aiReadToolsEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_READ_TOOLS_ENABLED
    aiMutationPlanningEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_MUTATION_PLANNING_ENABLED
    aiMutationExecutionEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_MUTATION_EXECUTION_ENABLED
    aiInvoiceIssueEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_INVOICE_ISSUE_ENABLED
    aiInvoiceVoidEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_INVOICE_VOID_ENABLED
    aiInvoiceReissueEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_INVOICE_REISSUE_ENABLED
    aiInvoiceAdjustmentEnabled: process.env.NODE_ENV !== "production", // NUXT_AI_INVOICE_ADJUSTMENT_ENABLED
    aiProviderTimeoutMs: 30_000, // NUXT_AI_PROVIDER_TIMEOUT_MS
    aiChatRateLimit: 20, // NUXT_AI_CHAT_RATE_LIMIT
    aiActionRateLimit: 30, // NUXT_AI_ACTION_RATE_LIMIT
    aiRateWindowSeconds: 60, // NUXT_AI_RATE_WINDOW_SECONDS
    aiCircuitFailureThreshold: 5, // NUXT_AI_CIRCUIT_FAILURE_THRESHOLD
    aiCircuitCooldownMs: 60_000, // NUXT_AI_CIRCUIT_COOLDOWN_MS
    aiMaxContextMessages: 20, // NUXT_AI_MAX_CONTEXT_MESSAGES
    aiMaxContextChars: 12_000, // NUXT_AI_MAX_CONTEXT_CHARS
    aiGlobalDailyLimit: 40, // NUXT_AI_GLOBAL_DAILY_LIMIT
    aiActionLeaseSeconds: 30, // NUXT_AI_ACTION_LEASE_SECONDS
    aiRetentionCleanupEnabled: true, // NUXT_AI_RETENTION_CLEANUP_ENABLED
    aiRetentionCleanupBatchSize: 500, // NUXT_AI_RETENTION_CLEANUP_BATCH_SIZE
    aiRetentionCleanupSecret: process.env.NUXT_AI_RETENTION_CLEANUP_SECRET || "", // NUXT_AI_RETENTION_CLEANUP_SECRET
    adminEmail: process.env.ADMIN_EMAIL || "", // ADMIN_EMAIL
    turnstileSecretKey: process.env.NUXT_TURNSTILE_SECRET_KEY || "", // NUXT_TURNSTILE_SECRET_KEY
    operationsReportAutoCloseSecret: process.env.NUXT_OPERATIONS_REPORT_AUTO_CLOSE_SECRET || "", // NUXT_OPERATIONS_REPORT_AUTO_CLOSE_SECRET
    operationsReportAutoCloseEnabled: process.env.NUXT_OPERATIONS_REPORT_AUTO_CLOSE_ENABLED === "true", // NUXT_OPERATIONS_REPORT_AUTO_CLOSE_ENABLED
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "", // NUXT_PUBLIC_SITE_URL
      gaId: process.env.NUXT_PUBLIC_GA_ID || "", // NUXT_PUBLIC_GA_ID
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || "", // NUXT_PUBLIC_TURNSTILE_SITE_KEY
      aiDevChatEnabled: process.env.NUXT_PUBLIC_AI_DEV_CHAT_ENABLED === "true", // NUXT_PUBLIC_AI_DEV_CHAT_ENABLED
      // Feature flag: one-click auto-issue ("Đã thu") on draft rows. Public so
      // the client can gate the row action; default off until staging-verified.
      billingAutoIssueEnabled: false, // NUXT_PUBLIC_BILLING_AUTO_ISSUE_ENABLED
      invoiceEmailEnabled: process.env.NUXT_PUBLIC_INVOICE_EMAIL_ENABLED === "true", // NUXT_PUBLIC_INVOICE_EMAIL_ENABLED
    },
  },

  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
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
        // PWA / installed app metadata (Android + iOS).
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Zeno" },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
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

  pwa: {
    // Single installable PWA for the whole app on one domain. Install once,
    // then `getRedirectByRole` routes the user to /portal or /dashboard.
    registerType: "autoUpdate",
    // Custom SW so authenticated SSR pages + /api/tenant/** payloads (including
    // signed URLs) are NEVER cached; only static assets + offline shell are.
    strategies: "injectManifest",
    srcDir: "service-worker",
    filename: "sw.ts",
    injectManifest: {
      globPatterns: ["offline.html", "icons/*.png", "favicon.ico"],
    },
    manifest: {
      name: "Zeno House",
      short_name: "Zeno",
      description: "Cổng thông tin người thuê Zeno House",
      lang: "vi",
      display: "standalone",
      orientation: "portrait",
      start_url: "/",
      scope: "/",
      theme_color: "#0b59db",
      background_color: "#f2f5fa",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    client: {
      // We present our own dismissible install prompt (PortalInstallPrompt).
      installPrompt: false,
    },
    devOptions: {
      enabled: false,
    },
  },
});
