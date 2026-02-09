import { useTheme } from './useTheme' // <-- Importa il gestore tema
import defaultImageLight from '@/assets/placeholder-initiative.jpg'
import defaultImageDark from '@/assets/placeholder-initiative-dark.jpg'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useImage() {
  const { isDark } = useTheme()

  const getImageUrl = (item) => {
    // Se l'oggetto passato ha direttamente path o filePath, usali subito
    if (item) {
      if (item.path) {
        let cleanPath = item.path.replace(/^[^h]*http/, 'http')
        if (cleanPath.startsWith('http')) {
          console.log('[getImageUrl] Uso path diretto:', cleanPath)
          return cleanPath
        }
        cleanPath = cleanPath.replace(/\\/g, '/')
        console.log('[getImageUrl] Uso path locale diretto:', `${API_URL}/${cleanPath}`)
        return `${API_URL}/${cleanPath}`
      }
      if (item.filePath) {
        if (item.filePath.startsWith('http')) {
          console.log('[getImageUrl] Uso filePath diretto:', item.filePath)
          return item.filePath
        }
        const cleanPath = item.filePath.replace(/\\/g, '/')
        console.log('[getImageUrl] Uso filePath locale diretto:', `${API_URL}/${cleanPath}`)
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

    console.log('[getImageUrl] item (fallback):', item)
    console.log('[getImageUrl] fileData (fallback):', fileData)

    if (fileData) {
      if (fileData.path) {
        let cleanPath = fileData.path.replace(/^[^h]*http/, 'http')
        if (cleanPath.startsWith('http')) {
          console.log('[getImageUrl] Uso path:', cleanPath)
          return cleanPath
        }
        cleanPath = cleanPath.replace(/\\/g, '/')
        console.log('[getImageUrl] Uso path locale:', `${API_URL}/${cleanPath}`)
        return `${API_URL}/${cleanPath}`
      }
      if (fileData.filePath) {
        if (fileData.filePath.startsWith('http')) {
          console.log('[getImageUrl] Uso filePath:', fileData.filePath)
          return fileData.filePath
        }
        const cleanPath = fileData.filePath.replace(/\\/g, '/')
        console.log('[getImageUrl] Uso filePath locale:', `${API_URL}/${cleanPath}`)
        return `${API_URL}/${cleanPath}`
      }
    }
    // --------------------

    return isDark.value ? defaultImageDark : defaultImageLight
  }

  return { getImageUrl }
}
