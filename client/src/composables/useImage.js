import { useTheme } from './useTheme' // <-- Importa il gestore tema
import defaultImageLight from '@/assets/placeholder-initiative.jpg'
import defaultImageDark from '@/assets/placeholder-initiative-dark.jpg'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useImage() {
  // Prendi la variabile reattiva isDark
  const { isDark } = useTheme()

  const getImageUrl = (item) => {
    // 1. Logica aggiornata: controlla prima l'array `attachments`
    if (item && item.attachments && item.attachments.length > 0) {
      const cleanPath = item.attachments[0].filePath.replace(/\\/g, '/');
      return `${API_URL}/${cleanPath}`;
    }

    // 2. Fallback alla vecchia logica per compatibilità
    if (item && item.attachment && item.attachment.filePath) {
      const cleanPath = item.attachment.filePath.replace(/\\/g, '/');
      return `${API_URL}/${cleanPath}`;
    }

    // 3. Placeholder reattivo al tema
    return isDark.value ? defaultImageDark : defaultImageLight;
  };

  return { getImageUrl }
}
