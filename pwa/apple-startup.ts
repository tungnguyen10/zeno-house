import { createAppleSplashScreens } from '@vite-pwa/assets-generator/config'

export const APPLE_SPLASH_LIGHT_BACKGROUND = '#f8fafc'
export const APPLE_SPLASH_DARK_BACKGROUND = '#0b1624'
export const APPLE_SPLASH_BASE_PATH = '/images/'

async function resolveDarkWordmark(imageName: string) {
  const { default: sharp } = await import('sharp')
  const { data, info } = await sharp(imageName)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (red === undefined || green === undefined || blue === undefined || alpha === undefined) continue

    if (red < 96 && green < 96 && blue < 96 && alpha > 0) {
      data[index] = 248
      data[index + 1] = 250
      data[index + 2] = 252
    }
  }

  return sharp(data, { raw: info }).png().toBuffer()
}

export const appleStartupName = (
  landscape: boolean,
  size: { width: number, height: number },
  dark?: boolean,
) => `apple-startup-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark' : 'light'}-${size.width}x${size.height}.png`

export const appleSplashScreens = createAppleSplashScreens({
  darkImageResolver: resolveDarkWordmark,
  padding: 0.3,
  resizeOptions: { background: APPLE_SPLASH_LIGHT_BACKGROUND, fit: 'contain' },
  darkResizeOptions: { background: APPLE_SPLASH_DARK_BACKGROUND, fit: 'contain' },
  linkMediaOptions: {
    addMediaScreen: true,
    basePath: APPLE_SPLASH_BASE_PATH,
    log: true,
    xhtml: false,
  },
  png: {
    compressionLevel: 9,
    quality: 60,
  },
  name: appleStartupName,
})

const uniqueSizes = [...new Map(
  appleSplashScreens.sizes.map(size => [`${size.width}x${size.height}@${size.scaleFactor}`, size]),
).values()]

export const appleStartupImages = uniqueSizes.flatMap((size) => {
  const deviceWidth = size.width / size.scaleFactor
  const deviceHeight = size.height / size.scaleFactor
  const deviceMedia = `(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${size.scaleFactor})`

  return ([false, true] as const).flatMap((dark) => (
    ([false, true] as const).map((landscape) => ({
      rel: 'apple-touch-startup-image' as const,
      href: `${APPLE_SPLASH_BASE_PATH}${appleStartupName(
        landscape,
        landscape ? { width: size.height, height: size.width } : size,
        dark,
      )}`,
      media: `screen and ${dark ? '(prefers-color-scheme: dark) and ' : ''}${deviceMedia} and (orientation: ${landscape ? 'landscape' : 'portrait'})`,
    }))
  ))
})
