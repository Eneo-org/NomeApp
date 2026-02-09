import { useTheme } from './useTheme' // <-- Importa il gestore tema
import defaultImageLight from '@/assets/placeholder-initiative.jpg'
import defaultImageDark from '@/assets/placeholder-initiative-dark.jpg'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useImage() {
  const { isDark } = useTheme()

  const getImageUrl = (item) => {
    // Se l'oggetto passato ha direttamente path, filePath o image, usali subito
    if (item) {
      // Controlla item.image (stringa diretta, es. da getExpiringInitiatives)
      if (typeof item.image === 'string' && item.image) {
        if (item.image.startsWith('http')) {
          return item.image
        }
        const cleanPath = item.image.replace(/\\/g, '/')
        return `${API_URL}/${cleanPath}`
      }
      if (item.path) {
        let cleanPath = item.path.replace(/^[^h]*http/, 'http')
        if (cleanPath.startsWith('http')) {
          return cleanPath
        }
        cleanPath = cleanPath.replace(/\\/g, '/')
        return `${API_URL}/${cleanPath}`
      }
      if (item.filePath) {
        if (item.filePath.startsWith('http')) {
          return item.filePath
        }
        const cleanPath = item.filePath.replace(/\\/g, '/')
        return `${API_URL}/${cleanPath}`
      }
    }

    // ... (tutta la logica di selezione fileData resta uguale: 1, 2, 3) ...
    let fileData = null
    if (item && Array.isArray(item.images) && item.images.length > 0) {
      fileData = item.images[0]
    } else if (item && Array.isArray(item.attachments) && item.attachments.length > 0) {
      fileData = item.attachments.find((att) => att.fileType && att.fileType.startsWith('image/'))
    } else if (item && item.attachment) {
      fileData = item.attachment
    }

    if (fileData) {
      if (fileData.path) {
        let cleanPath = fileData.path.replace(/^[^h]*http/, 'http')
        if (cleanPath.startsWith('http')) {
          return cleanPath
        }
        cleanPath = cleanPath.replace(/\\/g, '/')
        return `${API_URL}/${cleanPath}`
      }
      if (fileData.filePath) {
        if (fileData.filePath.startsWith('http')) {
          return fileData.filePath
        }
        const cleanPath = fileData.filePath.replace(/\\/g, '/')
        return `${API_URL}/${cleanPath}`
      }
    }
    // --------------------

    return isDark.value ? defaultImageDark : defaultImageLight
  }

  return { getImageUrl }
}
