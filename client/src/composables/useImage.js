import { useTheme } from './useTheme' // <-- Importa il gestore tema
import defaultImageLight from '@/assets/placeholder-initiative.jpg'
import defaultImageDark from '@/assets/placeholder-initiative-dark.jpg'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useImage() {
  // Prendi la variabile reattiva isDark
  const { isDark } = useTheme()

  const getImageUrl = (item) => {
    // 1. Immagine reale se esiste
    if (item && item.attachment && item.attachment.filePath) {
      const cleanPath = item.attachment.filePath.replace(/\\/g, '/')
      return `${API_URL}/${cleanPath}`
    }

    // 2. Placeholder reattivo: Vue ricalcola questa riga appena isDark cambia!
    return isDark.value ? defaultImageDark : defaultImageLight
  }

  return { getImageUrl }
}
