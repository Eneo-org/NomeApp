import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
  const messages = ref([])

  // Aggiunge un messaggio (tipo: 'success', 'error', 'info')
  const showToast = (text, type = 'info') => {
    const id = Date.now()
    messages.value.push({ id, text, type })

    // Rimuovi automaticamente dopo 3 secondi
    setTimeout(() => {
      removeToast(id)
    }, 3000)
  }

  const removeToast = (id) => {
    messages.value = messages.value.filter((m) => m.id !== id)
  }

  return { messages, showToast, removeToast }
})
