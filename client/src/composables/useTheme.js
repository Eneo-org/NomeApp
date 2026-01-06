import { ref } from 'vue'

// Stato condiviso (globale)
const isDark = ref(false)

export function useTheme() {
  // Funzione per inizializzare il tema all'avvio
  const initTheme = () => {
    // 1. Controlla prima se c'è una preferenza salvata
    const savedTheme = localStorage.getItem('theme')

    if (savedTheme) {
      // Se c'è, usa quella
      isDark.value = savedTheme === 'dark'
    } else {
      // 2. Se non c'è, controlla le impostazioni di sistema o classi esistenti
      isDark.value =
        document.body.classList.contains('dark') ||
        document.body.classList.contains('dark-mode') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    // Applica subito il tema corretto al DOM
    updateDOM()
  }

  // Funzione per cambiare tema (toggle)
  const toggleTheme = () => {
    isDark.value = !isDark.value

    // Salva la nuova preferenza nel localStorage
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')

    // Aggiorna il DOM
    updateDOM()
  }

  // Funzione interna per applicare le classi CSS
  const updateDOM = () => {
    if (isDark.value) {
      document.body.classList.add('dark', 'dark-mode')
      document.documentElement.classList.add('dark')
    } else {
      document.body.classList.remove('dark', 'dark-mode')
      document.documentElement.classList.remove('dark')
    }
  }

  return { isDark, toggleTheme, initTheme }
}
