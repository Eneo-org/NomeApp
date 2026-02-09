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

    // DEBUG: Mostra cosa arriva a getImageUrl e cosa viene usato
    console.log('[getImageUrl] item:', item)
    console.log('[getImageUrl] fileData:', fileData)

    if (fileData) {
      // Prima prova path
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
      // Poi prova filePath
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
