import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'
import { useToastStore } from './toastStore' // IMPORT STORE TOAST

const API_URL = import.meta.env.VITE_API_URL

export const useInitiativeStore = defineStore('initiative', () => {
  // Inizializza Toast Store
  const toast = useToastStore()

  // --- STATE ---
  const initiatives = ref([])
  const categories = ref([])
  const platforms = ref([])

  // FIX CRITICO: Inizializziamo sempre come array vuoto per evitare errori "includes of undefined"
  const followedIds = ref([])
  const followedInitiatives = followedIds // Alias per compatibilità con HomeView

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

  // Check sicuro: usa opzionale chaining o verifica array
  const isFollowed = (id) => followedIds.value?.includes(id)

  // --- ACTIONS ---

  const fetchFiltersData = async () => {
    try {
      const [resCat, resPlat] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/platforms`),
      ])
      categories.value = resCat.data.data
      platforms.value = resPlat.data.data
    } catch (err) {
      console.error('Errore filtri:', err) // Solo console, errore non critico per l'utente
    }
  }

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

      await fetchUserFollowedIds()
    } catch (err) {
      console.error('Errore fetch initiatives:', err)
      error.value = 'Impossibile caricare la lista.'
      // Nessun toast qui per non disturbare al caricamento pagina
    } finally {
      loading.value = false
    }
  }

  const fetchInitiativeDetail = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await axios.get(`${API_URL}/initiatives/${id}`)
      await fetchUserFollowedIds()
      return response.data
    } catch (err) {
      console.error('Errore fetch dettaglio:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const fetchInitiativeById = async (id) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      const response = await axios.get(`${API_URL}/initiatives/${id}`, {
        headers: { 'X-Mock-User-Id': storedId },
      })
      return response.data
    } catch (err) {
      console.error('Errore fetchInitiativeById:', err)
      return null
    }
  }

  // --- GESTIONE PREFERITI ---
  const fetchUserFollowedIds = async () => {
    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) {
      followedIds.value = []
      return
    }
    try {
      const res = await axios.get(`${API_URL}/users/me/initiatives`, {
        params: { relation: 'followed', objectsPerPage: 100 },
        headers: { 'X-Mock-User-Id': userId },
      })
      followedIds.value = res.data.data.map((item) => item.id)
    } catch (err) {
      console.error('Errore sync preferiti:', err)
      followedIds.value = [] // Fallback sicuro
    }
  }

  const toggleFollow = async (id = 'questa iniziativa') => {
    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) {
      toast.showToast('Devi effettuare il login.', 'error')
      return
    }

    const alreadyFollowed = isFollowed(id)

    if (alreadyFollowed) {
      // --- UNFOLLOW (Rimuovi) ---

      // 1. Aggiornamento Ottimistico: Rimuovi subito dalla lista locale
      followedIds.value = followedIds.value.filter((itemId) => itemId !== id)

      // 2. Feedback immediato
      toast.showToast('Rimossa dai preferiti', 'info')

      try {
        // 3. Chiamata API
        await axios.delete(`${API_URL}/initiatives/${id}/unfollows`, {
          headers: { 'X-Mock-User-Id': userId },
        })
      } catch (err) {
        // 4. Gestione Errori Intelligente
        if (err.response && err.response.status === 404) {
          // SE 404: Il backend dice "Non c'era nulla da cancellare".
          // Per noi va bene! Significa che siamo sincronizzati.
          console.warn('Sync Unfollow: Risorsa già rimossa (404 ignorato).')
        } else {
          // ERRORE VERO: Dobbiamo rimettere la stellina (Revert)
          console.error(err)
          followedIds.value.push(id)
          toast.showToast('Errore rete: impossibile rimuovere.', 'error')
        }
      }
    } else {
      // --- FOLLOW (Aggiungi) ---

      // 1. Aggiornamento Ottimistico
      if (!followedIds.value.includes(id)) followedIds.value.push(id)

      // 2. Feedback immediato
      toast.showToast('Aggiunta ai preferiti! ⭐', 'success')

      try {
        await axios.post(
          `${API_URL}/initiatives/${id}/follows`,
          {},
          { headers: { 'X-Mock-User-Id': userId } },
        )
      } catch (err) {
        if (err.response && err.response.status === 409) {
          // 409 Conflict: Già seguita. Va bene così.
          console.warn('Sync Follow: Già seguita.')
        } else {
          // ERRORE VERO: Revert
          followedIds.value = followedIds.value.filter((itemId) => itemId !== id)
          toast.showToast('Errore rete: impossibile aggiungere.', 'error')
        }
      }
    }
  }

  // Helper per il bottone del Toast "Tienimi Aggiornato"
  const ensureFollowed = async (id) => {
    if (!isFollowed(id)) {
      const userId = localStorage.getItem('tp_mock_id')
      if (!followedIds.value.includes(id)) followedIds.value.push(id)
      try {
        await axios.post(
          `${API_URL}/initiatives/${id}/follows`,
          {},
          { headers: { 'X-Mock-User-Id': userId } },
        )
      } catch (e) {
        /* ignore conflicts */
      }
    }
  }

  // --- AZIONI UTENTE (Firma) ---
  const signInitiative = async (initiativeId) => {
    const storedId = localStorage.getItem('tp_mock_id')
    const mockUserId = storedId ? parseInt(storedId) : null

    if (!mockUserId) {
      toast.showToast('Devi essere loggato per firmare.', 'error')
      return { success: false }
    }

    try {
      await axios.post(
        `${API_URL}/initiatives/${initiativeId}/signatures`,
        {},
        { headers: { 'X-Mock-User-Id': mockUserId } },
      )

      const init = initiatives.value.find((i) => i.id === initiativeId)
      if (init) init.signatures += 1

      // Il messaggio di successo è delegato a HomeView (Toast Custom),
      // ma se serve qui: toast.showToast('Firma registrata!', 'success')
      return { success: true }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        toast.showToast('Hai già firmato questa iniziativa!', 'info') // Info invece di errore rosso
      } else {
        console.error('Errore firma:', err)
        toast.showToast('Si è verificato un errore durante la firma.', 'error')
      }
      return { success: false, message: err.response?.data?.message }
    }
  }

  const createInitiative = async (payloadData) => {
    loading.value = true
    error.value = null
    const userId = localStorage.getItem('tp_mock_id')

    if (!userId) {
      toast.showToast('Sessione non valida. Effettua il login.', 'error')
      loading.value = false
      return false
    }

    try {
      const formData = new FormData()
      formData.append('title', payloadData.title)
      formData.append('description', payloadData.description)
      formData.append('place', payloadData.place || '')
      formData.append('categoryId', payloadData.categoryId)
      formData.append('platformId', payloadData.platformId || 1)

      // --- MODIFICA QUI PER MULTI-FILE ---
      if (payloadData.files && payloadData.files.length > 0) {
        // Iteriamo sull'array e aggiungiamo ogni file con la stessa chiave 'attachments'
        payloadData.files.forEach((file) => {
          formData.append('attachments', file)
        })
      }
      // Fallback per compatibilità (se per caso arrivasse ancora un singolo file)
      else if (payloadData.file) {
        formData.append('attachments', payloadData.file)
      }

      await axios.post(`${API_URL}/initiatives`, formData, {
        headers: {
          'X-Mock-User-Id': userId,
          'Content-Type': 'multipart/form-data',
        },
      })

      await fetchInitiatives() // Ricarica dati home page

      toast.showToast('Iniziativa creata con successo! 🎉', 'success')
      return true
    } catch (err) {
      console.error('Errore creazione:', err)

      // Gestione specifica errore 429 (Cooldown)
      if (err.response && err.response.status === 429) {
        const msg = err.response.data.message || 'Cooldown attivo.'
        // Se il backend manda remainingMs, potresti formattarlo qui,
        // ma il toast lo mostriamo già nella view prima di chiamare questo metodo (per sicurezza).
        error.value = msg
        toast.showToast(msg, 'error')
      } else {
        const msg = err.response?.data?.message || 'Errore durante la creazione.'
        error.value = msg
        toast.showToast(msg, 'error')
      }
      return false
    } finally {
      loading.value = false
    }
  }

  const checkUserCooldown = async () => {
    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) return { allowed: true } // Se non loggato, lasciamo gestire al router guard o login

    try {
      const res = await axios.get(`${API_URL}/initiatives/cooldown`, {
        headers: { 'X-Mock-User-Id': userId },
      })
      return res.data // Ritorna { allowed: bool, remainingMs: number }
    } catch (err) {
      console.error('Errore check cooldown', err)
      return { allowed: true } // In caso di errore rete, non blocchiamo l'UI preventivamente
    }
  }

  // --- AZIONI ADMIN ---
  const fetchExpiringInitiatives = async (page = 1) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      const response = await axios.get(
        `${API_URL}/initiatives/admin/expiring?currentPage=${page}&objectsPerPage=10`,
        { headers: { 'X-Mock-User-Id': storedId } },
      )
      return response.data
    } catch (err) {
      console.error('[Store] Errore fetchExpiring:', err)
      return null
    }
  }

  const submitAdminReply = async (initiativeId, status, motivation, files) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')

      const formData = new FormData()
      formData.append('status', status)
      formData.append('motivations', motivation)

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          formData.append('attachments', files[i])
        }
      }

      await axios.post(`${API_URL}/initiatives/${initiativeId}/responses`, formData, {
        headers: {
          'X-Mock-User-Id': storedId,
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.showToast('Risposta inviata e stato aggiornato!', 'success')
      return true
    } catch (err) {
      console.error('Errore invio risposta:', err)
      const msg = err.response?.data?.message || 'Errore invio risposta'
      toast.showToast(msg, 'error')
      throw msg
    }
  }

  const extendDeadline = async (id, currentExpirationDate) => {
    try {
      const userId = localStorage.getItem('tp_mock_id')

      // Calcoliamo la nuova data (+60 giorni)
      const newDate = new Date(currentExpirationDate)
      newDate.setDate(newDate.getDate() + 60)
      const formattedDate = newDate.toISOString().split('T')[0] // YYYY-MM-DD

      await axios.patch(
        `${API_URL}/initiatives/${id}`,
        { expirationDate: formattedDate }, // Body
        { headers: { 'X-Mock-User-Id': userId } },
      )

      return true
    } catch (err) {
      console.error('Errore estensione scadenza:', err)
      throw err // Rilancia l'errore per gestirlo nel componente
    }
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
    followedIds,
    followedInitiatives,
    isFollowed,
    getCategoryName,
    getPlatformName,
    fetchFiltersData,
    fetchInitiatives,
    fetchInitiativeDetail,
    signInitiative,
    createInitiative,
    toggleFollow,
    ensureFollowed,
    fetchUserFollowedIds,
    fetchExpiringInitiatives,
    submitAdminReply,
    fetchInitiativeById,
    checkUserCooldown,
    extendDeadline,
  }
})
