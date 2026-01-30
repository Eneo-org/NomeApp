import { useTheme } from './useTheme' // <-- Importa il gestore tema
import defaultImageLight from '@/assets/placeholder-initiative.jpg'
import defaultImageDark from '@/assets/placeholder-initiative-dark.jpg'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useImage() {
  // Prendi la variabile reattiva isDark
  const { isDark } = useTheme()

  const getImageUrl = (item) => {
    let fileData = null;

    // Prima controlliamo l'array `attachments` che è lo standard più recente
    if (item && Array.isArray(item.attachments) && item.attachments.length > 0) {
      fileData = item.attachments[0];
    }
    // Altrimenti, usiamo `attachment` per compatibilità con la vecchia struttura
    else if (item && item.attachment) {
      fileData = item.attachment;
    }

    // Se abbiamo trovato dei dati validi e c'è un percorso, costruiamo l'URL
    if (fileData && fileData.filePath) {
      const cleanPath = fileData.filePath.replace(/\\/g, '/');
      return `${API_URL}/${cleanPath}`;
    }

    // Altrimenti, usiamo il placeholder che dipende dal tema
    return isDark.value ? defaultImageDark : defaultImageLight;
  };

  return { getImageUrl }
}
