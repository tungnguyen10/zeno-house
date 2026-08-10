import { defineConfig } from '@vite-pwa/assets-generator/config'
import { appleSplashScreens } from './pwa/apple-startup'

const emptyAsset = { sizes: [] }

export default defineConfig({
  images: ['public/images/logo.png'],
  manifestIconsEntry: false,
  preset: {
    transparent: emptyAsset,
    maskable: emptyAsset,
    apple: emptyAsset,
    appleSplashScreens,
  },
})
