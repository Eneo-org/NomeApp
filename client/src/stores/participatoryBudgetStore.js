import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'

// Usa le variabili d'ambiente di Vite. Se non esiste, usa localhost come fallback.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useParticipatoryBudgetStore = defineStore('participatoryBudget', () => {
  // --- STATE ---
  const activeBudget = ref(null)
  const budgetArchive = ref([])
  const loading = ref(false)
  const error = ref(null)

  // --- HELPERS (Interni) ---
  const getAuthHeaders = () => {
    const storedId = localStorage.getItem('tp_mock_id')
    return storedId ? { 'X-Mock-User-Id': storedId } : {}
  }

  // --- ACTIONS ---

  // 1. FETCH BILANCIO ATTIVO (Home Page)
  const fetchActiveBudget = async () => {
    loading.value = true
    error.value = null
    try {
      // Nota: usiamo l'helper getAuthHeaders() se lo hai aggiunto, altrimenti gestiscilo come prima
      const storedId = localStorage.getItem('tp_mock_id')
      const headers = storedId ? { 'X-Mock-User-Id': storedId } : {}

      const response = await axios.get(`${API_URL}/participatory-budgets/active`, {
        headers: headers,
      })

      activeBudget.value = response.data.data || null
    } catch (err) {
      if (err.response && err.response.status === 404) {
        activeBudget.value = null
      } else {
        console.error('Errore fetch bilancio attivo:', err)
        error.value = 'Impossibile caricare il bilancio attivo.'
      }
    } finally {
      loading.value = false
    }
  }

  // 2. FETCH ARCHIVIO (Pagina Archivio - Admin)
  const fetchBudgetArchive = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await axios.get(`${API_URL}/participatory-budgets`, {
        headers: getAuthHeaders(),
      })
      // Gestisce sia { data: [...] } che [...] diretto, per sicurezza
      budgetArchive.value = response.data.data || response.data || []
    } catch (err) {
      console.error('Errore archivio bilanci:', err)
      if (err.response && (err.response.status === 403 || err.response.status === 401)) {
        throw new Error('Accesso negato: devi essere loggato come Admin.')
      } else {
        throw new Error("Impossibile caricare l'archivio.")
      }
    } finally {
      loading.value = false
    }
  }

  // 3. VOTA OPZIONE
  const voteBudgetOption = async (optionPosition) => {
    if (!activeBudget.value?.id) return

    const storedId = localStorage.getItem('tp_mock_id')
    if (!storedId) {
      throw new Error('Devi effettuare il login per votare.')
    }

    try {
      loading.value = true // Opzionale: utile se vuoi mostrare uno spinner durante il voto
      const budgetId = activeBudget.value.id

      await axios.post(
        `${API_URL}/participatory-budgets/${budgetId}/votes`,
        { position: optionPosition },
        { headers: getAuthHeaders() },
      )

      // Aggiorna i dati per vedere le nuove percentuali
      await fetchActiveBudget()

      // Ritorna true o semplicemente risolve la promise per indicare successo
      return true
    } catch (err) {
      console.error('Errore voto:', err)
      if (err.response) {
        if (err.response.status === 409) {
          throw new Error('Hai già votato per questo bilancio!')
        } else if (err.response.status === 403) {
          throw new Error('Votazione chiusa o permesso negato.')
        }
      }
      throw new Error(err.response?.data?.message || 'Errore durante il voto.')
    } finally {
      loading.value = false
    }
  }

  // 4. CREA NUOVO BILANCIO (Solo Admin)
  const createParticipatoryBudget = async (budgetData) => {
    loading.value = true
    error.value = null

    // Validazione Client-side
    if (!budgetData.options || budgetData.options.length !== 5) {
      loading.value = false
      throw new Error('Un bilancio partecipativo deve avere esattamente 5 opzioni.')
    }

    if (!localStorage.getItem('tp_mock_id')) {
      loading.value = false
      throw new Error('Devi essere loggato come Admin.')
    }

    try {
      await axios.post(`${API_URL}/participatory-budgets`, budgetData, {
        headers: getAuthHeaders(),
      })
      return true // Successo
    } catch (err) {
      console.error('Errore creazione bilancio:', err)
      if (err.response && err.response.status === 409) {
        throw new Error('Esiste già un bilancio attivo! Attendi che scada.')
      } else if (err.response && err.response.status === 403) {
        throw new Error('Non hai i permessi di Amministratore.')
      }
      throw new Error(err.response?.data?.message || err.message)
    } finally {
      loading.value = false
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
    createParticipatoryBudget,
  }
})
