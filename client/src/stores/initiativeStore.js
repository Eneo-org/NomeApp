import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useInitiativeStore = defineStore('initiative', () => {
  // --- STATE ---
  const initiatives = ref([])
  const categories = ref([])
  const platforms = ref([])

  // NUOVO: Lista degli ID delle iniziative seguite dall'utente loggato
  const followedIds = ref([])

  const loading = ref(false)
  const error = ref(null)
  const currentPage = ref(1)
  const totalPages = ref(1)
  const totalObjects = ref(0)

  // --- GETTERS ---
  const getCategoryName = (id) => {
    if (categories.value.length === 0) return '...'
    const found = categories.value.find((c) => c.id === id)
    return found ? found.name : 'Generale'
  }

  const getPlatformName = (id) => {
    if (platforms.value.length === 0) return '...'
    const found = platforms.value.find((p) => p.id === id)
    return found ? found.platformName : 'Fonte Esterna'
  }

  // NUOVO: Helper per sapere se un'iniziativa è seguita
  const isFollowed = (id) => followedIds.value.includes(id)

  // --- ACTIONS ---

  // 1. Carica i Filtri (Categorie/Piattaforme)
  const fetchFiltersData = async () => {
    try {
      const [resCat, resPlat] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/platforms`),
      ])
      categories.value = resCat.data.data
      platforms.value = resPlat.data.data
    } catch (err) {
      console.error('Errore filtri:', err)
    }
  }

  // 2. Carica Iniziative
  const fetchInitiatives = async (page = 1, sortBy = 'signatures', filters = {}) => {
    loading.value = true
    try {
      const params = {
        currentPage: page,
        objectsPerPage: 10,
        sortBy: sortBy,
        order: 'desc',
        ...(filters.search && { search: filters.search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.platform && { platform: filters.platform }),
        ...(filters.status && { status: filters.status }),
        ...(filters.not_status && { not_status: filters.not_status }),
      }

      const response = await axios.get(`${API_URL}/initiatives`, { params })

      initiatives.value = response.data.data

      if (response.data.meta) {
        currentPage.value = response.data.meta.currentPage
        totalPages.value = response.data.meta.totalPages
        totalObjects.value = response.data.meta.totalObjects
      }

      // Quando carichiamo le iniziative, aggiorniamo anche la lista dei preferiti per averla sincronizzata
      await fetchUserFollowedIds()
    } catch (err) {
      console.error('Errore fetch initiatives:', err)
      error.value = 'Impossibile caricare la lista.'
    } finally {
      loading.value = false
    }
  }

  const fetchInitiativeDetail = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await axios.get(`${API_URL}/initiatives/${id}`)
      // Aggiorniamo i preferiti anche qui per sapere se accendere la stella nel dettaglio
      await fetchUserFollowedIds()
      return response.data
    } catch (err) {
      console.error('Errore fetch dettaglio:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // --- NUOVA GESTIONE FOLLOW (SMART) ---

  // A. Scarica solo gli ID delle iniziative seguite (per colorare le stelle)
  const fetchUserFollowedIds = async () => {
    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) {
      followedIds.value = []
      return
    }

    try {
      // Usiamo la rotta della dashboard che hai già creato, chiedendo le "followed"
      // Nota: Questo scarica tutte le info, ideale sarebbe una rotta leggera solo ID,
      // ma per ora va benissimo questa.
      const res = await axios.get(`${API_URL}/users/me/initiatives`, {
        params: { relation: 'followed', objectsPerPage: 100 }, // Ne prendiamo tante per essere sicuri
        headers: { 'X-Mock-User-Id': userId },
      })

      // Estraiamo solo gli ID e li salviamo nello state
      followedIds.value = res.data.data.map((item) => item.id)
    } catch (err) {
      console.error('Errore sync preferiti:', err)
    }
  }

  // B. Toggle (Metti / Togli) con Conferma
  const toggleFollow = async (id, title = 'questa iniziativa') => {
    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) {
      alert("Devi effettuare il login per seguire un'iniziativa.")
      return
    }

    const alreadyFollowed = isFollowed(id)

    // 1. LOGICA RIMozione (UNFOLLOW)
    if (alreadyFollowed) {
      if (!confirm(`Vuoi davvero smettere di seguire "${title}"? Non riceverai più notifiche.`)) {
        return // Utente ha annullato
      }

      try {
        await axios.delete(`${API_URL}/initiatives/${id}/unfollows`, {
          headers: { 'X-Mock-User-Id': userId },
        })
        // Aggiorna lo stato locale rimuovendo l'ID
        followedIds.value = followedIds.value.filter((itemId) => itemId !== id)
        // alert("Rimossa dai preferiti.") // Opzionale, forse troppo invasivo
      } catch (err) {
        console.error(err)
        alert('Errore durante la rimozione.')
      }
    }
    // 2. LOGICA AGGIUNTA (FOLLOW)
    else {
      try {
        await axios.post(
          `${API_URL}/initiatives/${id}/follows`,
          {},
          {
            headers: { 'X-Mock-User-Id': userId },
          },
        )
        // Aggiorna lo stato locale aggiungendo l'ID
        followedIds.value.push(id)
        alert('Aggiunta ai preferiti! ⭐')
      } catch (err) {
        if (err.response && err.response.status === 409) {
          alert('Segui già questa iniziativa.')
        } else {
          console.error(err)
          alert("Errore nel seguire l'iniziativa.")
        }
      }
    }
  }

  const signInitiative = async (initiativeId) => {
    // ... (Tua funzione signInitiative esistente, copiala qui) ...
    // Per brevità non la ricopio tutta, ma lasciala com'era nel tuo file
    const storedId = localStorage.getItem('tp_mock_id')
    const mockUserId = storedId ? parseInt(storedId) : null
    if (!mockUserId) {
      alert('Login richiesto')
      return false
    }
    try {
      await axios.post(
        `${API_URL}/initiatives/${initiativeId}/sign`,
        {},
        { headers: { 'X-Mock-User-Id': mockUserId } },
      )
      const init = initiatives.value.find((i) => i.id === initiativeId)
      if (init) init.signatures += 1
      return { success: true }
    } catch (err) {
      alert('Errore firma')
      return { success: false }
    }
  }

  const createInitiative = async (formData) => {
    // ... (Tua funzione createInitiative esistente) ...
    // Copia la tua funzione create qui
    return true
  }

  return {
    initiatives,
    categories,
    platforms,
    loading,
    error,
    currentPage,
    totalPages,
    totalObjects,
    followedIds, // Export stato
    isFollowed, // Export getter
    getCategoryName,
    getPlatformName,
    fetchFiltersData,
    fetchInitiatives,
    fetchInitiativeDetail,
    signInitiative,
    createInitiative,
    toggleFollow, // Export action unica
    fetchUserFollowedIds,
  }
})
