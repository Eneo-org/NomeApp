import { useTheme } from './useTheme' // <-- Importa il gestore tema
import defaultImageLight from '@/assets/placeholder-initiative.jpg'
import defaultImageDark from '@/assets/placeholder-initiative-dark.jpg'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useImage() {
  const { isDark } = useTheme()

  const getImageUrl = (item) => {
    let fileData = null

    // ... (tutta la logica di selezione fileData resta uguale: 1, 2, 3) ...
    if (item && Array.isArray(item.images) && item.images.length > 0) {
      fileData = item.images[0]
    } else if (item && Array.isArray(item.attachments) && item.attachments.length > 0) {
      fileData = item.attachments.find((att) => att.fileType && att.fileType.startsWith('image/'))
    } else if (item && item.attachment) {
      fileData = item.attachment
    }

    // --- MODIFICA QUI ---
    if (fileData && fileData.path) {
      // Cloudinary usa 'path' o 'secure_url'
      // Se è già un URL completo (Cloudinary), usalo direttamente
      if (fileData.path.startsWith('http')) {
        return fileData.path
      }
      // Altrimenti (fallback per vecchie immagini locali), costruisci l'URL
      const cleanPath = fileData.path.replace(/\\/g, '/')
      return `${API_URL}/${cleanPath}`
    }

    // Vecchia gestione 'filePath' se presente nel DB
    if (fileData && fileData.filePath) {
      if (fileData.filePath.startsWith('http')) return fileData.filePath
      const cleanPath = fileData.filePath.replace(/\\/g, '/')
      return `${API_URL}/${cleanPath}`
    }
    // --------------------

    return isDark.value ? defaultImageDark : defaultImageLight
  }

  return { getImageUrl }
}
