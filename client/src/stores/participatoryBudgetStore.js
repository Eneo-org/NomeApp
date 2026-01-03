import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useParticipatoryBudgetStore = defineStore('participatoryBudget', () => {
  // --- STATE ---
  const activeBudget = ref(null)
  const budgetArchive = ref([])
  const loading = ref(false)
  const error = ref(null)

  // --- ACTIONS ---

  // 1. FETCH BILANCIO ATTIVO (Home Page)
  const fetchActiveBudget = async () => {
    try {
      // Usiamo ID 1 (Cittadino) per vedere il bilancio attivo e se ho votato
      // (Questo sarà dinamico dopo aver fatto il Login)
      const mockUserId = 1

      const response = await axios.get(`${API_URL}/participatory-budgets/active`, {
        headers: { 'X-Mock-User-Id': mockUserId },
      })

      activeBudget.value = response.data
    } catch (err) {
      if (err.response && err.response.status === 404) {
        activeBudget.value = null // Nessun bilancio attivo
      } else {
        console.error('Errore fetch bilancio attivo:', err)
      }
    }
  }

  // 2. FETCH ARCHIVIO (Pagina Archivio)
  const fetchBudgetArchive = async () => {
    loading.value = true
    error.value = null
    try {
      // ⚠️ TRUCCO TEMPORANEO:
      // Il backend attuale permette di vedere l'archivio SOLO agli ADMIN.
      // Quindi qui simuliamo di essere l'Admin (ID 2) per scaricare i dati.
      // Quando implementeremo il login, useremo l'ID dell'utente loggato.
      const mockAdminId = 2

      const response = await axios.get(`${API_URL}/participatory-budgets`, {
        headers: { 'X-Mock-User-Id': mockAdminId },
      })

      // Il backend restituisce { data: [...], meta: ... }
      budgetArchive.value = response.data.data || []
    } catch (err) {
      console.error('Errore archivio bilanci:', err)
      // Se il backend risponde 403/401, lo mostriamo
      if (err.response && (err.response.status === 403 || err.response.status === 401)) {
        error.value =
          "Accesso negato: solo gli amministratori possono vedere l'archivio (Regola attuale Backend)."
      } else {
        error.value = "Impossibile caricare l'archivio."
      }
    } finally {
      loading.value = false
    }
  }

  // 3. VOTA OPZIONE
  const voteBudgetOption = async (optionId) => {
    if (!activeBudget.value) return

    // Simuliamo il Cittadino (ID 1)
    const mockUserId = 1

    try {
      // Nota: optionId che arriva dal frontend è la POSIZIONE (1, 2, 3),
      // che è esattamente quello che si aspetta il backend nel body.
      await axios.post(
        `${API_URL}/participatory-budgets/vote`,
        {
          participatoryBudgetId: activeBudget.value.id,
          position: optionId, // Il backend si aspetta 'position'
        },
        {
          headers: { 'X-Mock-User-Id': mockUserId },
        },
      )

      // Aggiornamento ottimistico interfaccia (segna come votato)
      activeBudget.value.votedOptionId = optionId
      alert('Voto registrato con successo!')
    } catch (err) {
      console.error('Errore voto:', err)
      if (err.response && err.response.status === 409) {
        alert('Hai già votato per questo bilancio!')
      } else if (err.response && err.response.status === 403) {
        alert('Errore: Solo i cittadini possono votare o il bilancio è scaduto.')
      } else {
        alert('Errore durante il voto. Riprova.')
      }
    }
  }

  return {
    activeBudget,
    budgetArchive,
    loading,
    error,
    fetchActiveBudget,
    fetchBudgetArchive,
    voteBudgetOption,
  }
})
