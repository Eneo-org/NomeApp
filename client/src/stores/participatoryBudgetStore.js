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
      // RECUPERO UTENTE REALE (Se loggato)
      const storedId = localStorage.getItem('tp_mock_id')
      // Se non c'è ID (utente ospite), non mandiamo l'header o mandiamo null.
      // Il backend dovrebbe restituire il bilancio ma senza info sul "voto dato".
      const headers = storedId ? { 'X-Mock-User-Id': storedId } : {}

      const response = await axios.get(`${API_URL}/participatory-budgets/active`, {
        headers: headers,
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
      // RECUPERO UTENTE REALE
      const storedId = localStorage.getItem('tp_mock_id')
      // Se non sei loggato, la chiamata fallirà (401), che è corretto.

      const response = await axios.get(`${API_URL}/participatory-budgets`, {
        headers: { 'X-Mock-User-Id': storedId },
      })

      // Il backend restituisce { data: [...], meta: ... }
      budgetArchive.value = response.data.data || []
    } catch (err) {
      console.error('Errore archivio bilanci:', err)
      // Se il backend risponde 403/401, lo mostriamo
      if (err.response && (err.response.status === 403 || err.response.status === 401)) {
        error.value = "Accesso negato: devi essere loggato (e forse Admin) per vedere l'archivio."
      } else {
        error.value = "Impossibile caricare l'archivio."
      }
    } finally {
      loading.value = false
    }
  }

  // 3. VOTA OPZIONE (CORRETTO)
  const voteBudgetOption = async (optionId) => {
    // Controllo preliminare
    if (!activeBudget.value || !activeBudget.value.id) return

    // 1. RECUPERO UTENTE REALE DAL LOCALSTORAGE
    const storedId = localStorage.getItem('tp_mock_id')
    if (!storedId) {
      alert('Devi effettuare il login per votare.')
      return
    }

    try {
      const budgetId = activeBudget.value.id

      // 2. CHIAMATA AXIOS CORRETTA
      // URL: /participatory-budgets/:id/vote
      // Body: { position: 1 }
      const response = await axios.post(
        `${API_URL}/participatory-budgets/${budgetId}/votes`,
        {
          position: optionId, // Il backend si aspetta 'position'
        },
        {
          headers: { 'X-Mock-User-Id': storedId },
        },
      )

      // 3. AGGIORNAMENTO STATO
      // Il backend ci restituisce l'oggetto aggiornato con "votedOptionId" popolato.
      // Sostituiamo direttamente l'oggetto locale.
      activeBudget.value = response.data

      alert('Voto registrato con successo! ✅')
    } catch (err) {
      console.error('Errore voto:', err)

      if (err.response) {
        if (err.response.status === 409) {
          alert('Hai già votato per questo bilancio!')
        } else if (err.response.status === 403) {
          alert('Errore: Solo i cittadini possono votare o il bilancio è scaduto.')
        } else if (err.response.status === 404) {
          alert('Errore 404: URL Voto non trovato. Controlla il backend.')
        } else {
          alert('Errore durante il voto: ' + (err.response.data.message || 'Sconosciuto'))
        }
      } else {
        alert('Errore di connessione.')
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
