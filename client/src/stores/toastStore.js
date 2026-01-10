import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])

  // Durate
  const DURATION_NORMAL = 5000
  const DURATION_PROMPT = 30000

  /**
   * Mostra un toast.
   */
  const showToast = (message, type = 'info', options = {}) => {
    // FIX: Usiamo Date.now() + un numero casuale per evitare ID duplicati
    // se due toast partono nello stesso millisecondo.
    const id = Date.now() + Math.random().toString(36).substr(2, 9)

    // 1. LOGICA DURATA
    let duration = options.duration
    if (duration === undefined) {
      duration = type === 'prompt' ? DURATION_PROMPT : DURATION_NORMAL
    }

    // 2. LOGICA AZIONI
    const actions = options.actions || null

    // 3. AGGIUNTA
    toasts.value.push({
      id,
      message,
      type,
      actions,
    })

    // 4. TIMER RIMOZIONE
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }

  const removeToast = (id) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, showToast, removeToast }
})
