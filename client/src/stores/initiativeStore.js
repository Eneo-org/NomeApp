import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useInitiativeStore = defineStore('initiative', () => {
  // --- STATE ---
  const initiatives = ref([])

  // Modifica: Ora sono array reattivi che carichiamo dal server
  const categories = ref([])
  const platforms = ref([])

  const loading = ref(false)
  const error = ref(null)

  // Paginazione
  const currentPage = ref(1)
  const totalPages = ref(1)

  // --- GETTERS ---
  // Modifica: Cerchiamo l'ID dentro l'array dinamico
  const getCategoryName = (id) => {
    if (categories.value.length === 0) return 'Caricamento...'
    const found = categories.value.find((c) => c.id === id)
    return found ? found.name : 'Generale'
  }

  const getPlatformName = (id) => {
    if (platforms.value.length === 0) return 'Esterna'
    const found = platforms.value.find((p) => p.id === id)
    return found ? found.platformName : 'Fonte Esterna'
  }

  // --- ACTIONS ---

  // 1. NUOVA AZIONE: Carica i filtri dal Backend
  const fetchFiltersData = async () => {
    try {
      // Eseguiamo le due chiamate in parallelo
      const [resCat, resPlat] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/platforms`),
      ])

      // Salviamo i dati nello state
      categories.value = resCat.data.data
      platforms.value = resPlat.data.data

      console.log('Filtri caricati dal backend.')
    } catch (err) {
      console.error('Errore caricamento filtri:', err)
      // Non blocchiamo l'app, al massimo si vedranno nomi generici
    }
  }

  // 2. FETCH LISTA INIZIATIVE (Aggiornata con filtri)
  const fetchInitiatives = async (page = 1, sortBy = 'signatures', filters = {}) => {
    loading.value = true
    error.value = null

    try {
      // Costruiamo i parametri dinamici
      const params = {
        currentPage: page,
        objectsPerPage: 10,
        sortBy: sortBy,
        order: 'desc',
        // Aggiungiamo i filtri solo se sono valorizzati
        ...(filters.search && { search: filters.search }),
        ...(filters.place && { place: filters.place }),
        ...(filters.category && { category: filters.category }),
        ...(filters.platform && { platform: filters.platform }),
      }

      const response = await axios.get(`${API_URL}/initiatives`, { params })

      initiatives.value = response.data.data

      if (response.data.meta) {
        currentPage.value = response.data.meta.currentPage
        totalPages.value = response.data.meta.totalPages
      }

      console.log(`Iniziative caricate: Pagina ${currentPage.value} di ${totalPages.value}`)
    } catch (err) {
      console.error('Errore fetch initiatives:', err)
      error.value = 'Impossibile caricare la lista delle iniziative.'
    } finally {
      loading.value = false
    }
  }

  // 3. FETCH DETTAGLIO
  const fetchInitiativeDetail = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await axios.get(`${API_URL}/initiatives/${id}`)
      return response.data
    } catch (err) {
      console.error('Errore fetch dettaglio:', err)
      error.value = 'Impossibile caricare i dettagli.'
      return null
    } finally {
      loading.value = false
    }
  }

  // 4. FIRMA INIZIATIVA
  const signInitiative = async (initiativeId) => {
    // Cerchiamo di recuperare l'ID utente dal localStorage se c'è (grazie al login simulato)
    const storedId = localStorage.getItem('tp_mock_id')
    const mockUserId = storedId ? parseInt(storedId) : 1

    try {
      await axios.post(
        `${API_URL}/initiatives/${initiativeId}/sign`,
        {},
        {
          headers: { 'X-Mock-User-Id': mockUserId },
        },
      )

      const init = initiatives.value.find((i) => i.id === initiativeId)
      if (init) init.signatures += 1

      return true
    } catch (err) {
      if (err.response && err.response.status === 409) {
        alert('Hai già firmato questa iniziativa!')
      } else if (err.response && err.response.status === 401) {
        alert('Devi effettuare il login per firmare.')
      } else {
        console.error('Errore firma:', err)
        alert('Impossibile firmare al momento.')
      }
      return false
    }
  }

  return {
    initiatives,
    categories, // Ora è reattivo
    platforms, // Ora è reattivo
    loading,
    error,
    currentPage,
    totalPages,
    getCategoryName,
    getPlatformName,
    fetchFiltersData, // Nuova azione esportata
    fetchInitiatives,
    fetchInitiativeDetail,
    signInitiative,
  }
})
