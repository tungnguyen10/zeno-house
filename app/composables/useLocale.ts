import { format } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'

export function useLocale() {
  const { locale, setLocale } = useI18n()

  const dateLocales = { vi, en: enUS }

  async function switchLocale(code: 'vi' | 'en') {
    await setLocale(code)
  }

  function formatCurrency(amount: number, currency = 'VND'): string {
    return new Intl.NumberFormat(locale.value === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  function formatDate(date: Date | string, pattern = 'dd/MM/yyyy'): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const localeObj = dateLocales[locale.value as keyof typeof dateLocales] ?? vi
    return format(d, pattern, { locale: localeObj })
  }

  return { locale, switchLocale, formatCurrency, formatDate }
}
