import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'
import { useToastStore } from './toastStore' // IMPORT STORE TOAST
import { useUserStore } from './userStore';

const API_URL = import.meta.env.VITE_API_URL

export const useInitiativeStore = defineStore('initiative', () => {
  // Inizializza Toast Store
  const toast = useToastStore()
  const userStore = useUserStore()

  // --- STATE ---
  // Array separati per evitare conflitti tra Home e Archive
  const initiatives = ref([]) // Array generico (deprecato, manteniamo per compatibilità)
  const homeInitiatives = ref([]) // Solo per la Home
  const archiveInitiatives = ref([]) // Solo per l'Archivio
  
  const categories = ref([])
  const platforms = ref([])

  const followedIds = ref([])
  const followedInitiatives = followedIds // Alias per compatibilità con HomeView

  const signedIds = ref([])

  // Loading separati per evitare conflitti
  const loading = ref(false)
  const homeLoading = ref(false)
  const archiveLoading = ref(false)
  const detailLoading = ref(false)
  
  const error = ref(null)
  const currentPage = ref(1)
  const totalPages = ref(1)
  const totalObjects = ref(0)

  // Flag per prevenire chiamate duplicate
  const isFetchingFollowed = ref(false)
  const isFetchingSigned = ref(false)
  const isFetchingFilters = ref(false)
  const isFetchingInitiatives = ref(false)

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

  // --- NUOVO: Getter per controllare se l'utente ha firmato ---
  const hasSigned = (id) => signedIds.value?.includes(id)

  // --- ACTIONS ---

  const fetchFiltersData = async () => {
    // Se già caricato o fetch in corso, skip
    if ((categories.value.length > 0 && platforms.value.length > 0) || isFetchingFilters.value) {
      console.log('⏭️ Filtri già caricati o fetch in corso, skip')
      return
    }

    isFetchingFilters.value = true
    
    try {
      const [resCat, resPlat] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/platforms`),
      ])
      categories.value = resCat.data.data
      platforms.value = resPlat.data.data
      console.log('✅ Filtri caricati:', categories.value.length, 'categorie,', platforms.value.length, 'piattaforme')
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn('⚠️ Rate limit per filtri')
      } else {
        console.error('Errore filtri:', err)
      }
    } finally {
      isFetchingFilters.value = false
    }
  }

  // sortBy: 1 = Data Creazione, 2 = Numero Firme
  // context: 'home' o 'archive' per popolare l'array corretto
  const fetchInitiatives = async (page = 1, sortBy = 1, filters = {}, context = 'archive') => {
    // Previeni chiamate duplicate
    if (isFetchingInitiatives.value) {
      console.log('⏭️ fetchInitiatives già in corso, skip')
      return
    }

    isFetchingInitiatives.value = true
    
    // Usa loading specifico per contesto
    if (context === 'home') {
      homeLoading.value = true
    } else {
      archiveLoading.value = true
    }
    loading.value = true
    
    try {
      const params = {
        currentPage: page,
        objectsPerPage: context === 'home' ? 6 : 10, // Home: 6 iniziative, Archive: 10
        sortBy: sortBy,
        order: filters.order || 'desc',
        ...(filters.search && { search: filters.search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.platform && { platform: filters.platform }),
        ...(filters.status && { status: filters.status }),
        ...(filters.not_status && { not_status: filters.not_status }),
      }

      console.log(`🔍 [${context.toUpperCase()}] Fetch iniziative:`, params);
      const response = await axios.get(`${API_URL}/initiatives`, { params })

      // Popola l'array corretto in base al contesto
      if (context === 'home') {
        homeInitiatives.value = response.data.data
        console.log('🏠 Home iniziatives aggiornate:', homeInitiatives.value.length)
      } else {
        archiveInitiatives.value = response.data.data
        console.log('📚 Archive iniziatives aggiornate:', archiveInitiatives.value.length)
      }
      
      // Manteniamo anche l'array generico per retrocompatibilità
      initiatives.value = response.data.data

      if (response.data.meta) {
        currentPage.value = response.data.meta.currentPage
        totalPages.value = response.data.meta.totalPages
        totalObjects.value = response.data.meta.totalObjects
      }

      // NON chiamare fetchUserFollowedIds qui - lasciare che i componenti lo chiamino quando necessario
      // Questo evita troppe richieste simultanee
      
    } catch (err) {
      console.error('Errore fetch initiatives:', err)
      if (err.response?.status === 429) {
        toast.showToast('⚠️ Troppe richieste, attendi un momento...', 'warning')
      } else {
        error.value = 'Impossibile caricare la lista.'
      }
    } finally {
      loading.value = false
      if (context === 'home') {
        homeLoading.value = false
      } else {
        archiveLoading.value = false
      }
      isFetchingInitiatives.value = false
    }
  }

  const fetchInitiativeDetail = async (id) => {
    detailLoading.value = true
    error.value = null
    try {
      console.log(`🔍 Fetch dettaglio iniziativa ID: ${id}`)
      const response = await axios.get(`${API_URL}/initiatives/${id}`)
      console.log('✅ Dettaglio ricevuto:', response.data?.title || 'NO TITLE')
      // NON chiamare fetchUserFollowedIds qui - viene chiamato in fetchInitiatives
      return response.data
    } catch (err) {
      console.error('❌ Errore fetch dettaglio:', err.response?.status, err.message)
      if (err.response?.status === 429) {
        toast.showToast('⚠️ Troppe richieste, attendi un momento...', 'warning')
      }
      return null
    } finally {
      detailLoading.value = false
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
    // Previeni chiamate duplicate
    if (isFetchingFollowed.value) {
      console.log('⏭️ fetchUserFollowedIds già in corso, skip')
      return
    }

    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) {
      followedIds.value = []
      return
    }

    isFetchingFollowed.value = true
    
    try {
      const res = await axios.get(`${API_URL}/users/me/initiatives`, {
        params: { relation: 'followed', objectsPerPage: 100 },
        headers: { 'X-Mock-User-Id': userId },
      })
      followedIds.value = res.data.data.map((item) => item.id)
    } catch (err) {
      // Gestione specifica del rate limiting
      if (err.response?.status === 429) {
        console.warn('⚠️ Rate limit raggiunto per preferiti, riprovo tra 2 secondi...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        // Non richiamare automaticamente per evitare loop
      } else {
        console.error('Errore sync preferiti:', err)
      }
      followedIds.value = [] // Fallback sicuro
    } finally {
      isFetchingFollowed.value = false
    }
  }

  // --- NUOVO: GESTIONE FIRME (Fetch iniziale) ---
  const fetchUserSignedIds = async () => {
    // Previeni chiamate duplicate
    if (isFetchingSigned.value) {
      console.log('⏭️ fetchUserSignedIds già in corso, skip')
      return
    }

    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) {
      signedIds.value = []
      return
    }

    isFetchingSigned.value = true
    
    try {
      // Assumiamo che il backend supporti relation='signed'
      const res = await axios.get(`${API_URL}/users/me/initiatives`, {
        params: { relation: 'signed', objectsPerPage: 100 },
        headers: { 'X-Mock-User-Id': userId },
      })
      signedIds.value = res.data.data.map((item) => item.id)
    } catch (err) {
      // Gestione specifica del rate limiting
      if (err.response?.status === 429) {
        console.warn('⚠️ Rate limit raggiunto per firme, riprovo tra 2 secondi...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        // Non richiamare automaticamente per evitare loop
      } else {
        console.error('Errore sync firme:', err)
      }
      // Non resettiamo signedIds qui per evitare "flash", ma gestiamo l'errore
    } finally {
      isFetchingSigned.value = false
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
      followedIds.value = followedIds.value.filter((itemId) => itemId !== id)
      toast.showToast('Rimossa dai preferiti', 'info')

      try {
        await axios.delete(`${API_URL}/initiatives/${id}/follows`, {
          headers: { 'X-Mock-User-Id': userId },
        })
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.warn('Sync Unfollow: Risorsa già rimossa (404 ignorato).')
        } else {
          console.error(err)
          followedIds.value.push(id) // Revert
          toast.showToast('Errore rete: impossibile rimuovere.', 'error')
        }
      }
    } else {
      // --- FOLLOW (Aggiungi) ---
      if (!followedIds.value.includes(id)) followedIds.value.push(id)
      toast.showToast('Aggiunta ai preferiti! ⭐', 'success')

      try {
        await axios.post(
          `${API_URL}/initiatives/${id}/follows`,
          {},
          { headers: { 'X-Mock-User-Id': userId } },
        )
      } catch (err) {
        if (err.response && err.response.status === 409) {
          console.warn('Sync Follow: Già seguita.')
        } else {
          followedIds.value = followedIds.value.filter((itemId) => itemId !== id) // Revert
          toast.showToast('Errore rete: impossibile aggiungere.', 'error')
        }
      }
    }
  }

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

      // Non aggiorniamo l'oggetto initiative qui per evitare problemi
      // Il contatore verrà aggiornato quando si ricarica il dettaglio
      
      // --- NUOVO: Aggiornamento ottimistico dello stato firma ---
      if (!signedIds.value.includes(initiativeId)) {
        signedIds.value.push(initiativeId)
      }

      return { success: true }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        // Se il backend dice "Già firmato", aggiorniamo lo store locale per allinearci
        if (!signedIds.value.includes(initiativeId)) {
          signedIds.value.push(initiativeId)
        }
        toast.showToast('Hai già firmato questa iniziativa!', 'info')
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
      return { success: false, initiativeId: null }
    }

    try {
      const formData = new FormData()
      formData.append('title', payloadData.title)
      formData.append('description', payloadData.description)
      formData.append('place', payloadData.place || '')
      formData.append('categoryId', payloadData.categoryId)
      formData.append('platformId', payloadData.platformId || 1)

      if (payloadData.files && payloadData.files.length > 0) {
        payloadData.files.forEach((file) => {
          formData.append('attachments', file)
        })
      } else if (payloadData.file) {
        formData.append('attachments', payloadData.file)
      }

      const response = await axios.post(`${API_URL}/initiatives`, formData, {
        headers: {
          'X-Mock-User-Id': userId,
          'Content-Type': 'multipart/form-data',
        },
      })

      // Il backend restituisce { id: 123, title: "...", ... }
      const createdInitiativeId = response.data.id

      console.log('✅ Iniziativa creata con ID:', createdInitiativeId)

      toast.showToast('Iniziativa creata con successo! 🎉', 'success')
      
      return { success: true, initiativeId: createdInitiativeId }
    } catch (err) {
      console.error('Errore creazione:', err)

      if (err.response && err.response.status === 429) {
        const msg = err.response.data.message || 'Cooldown attivo.'
        error.value = msg
        toast.showToast(msg, 'error')
      } else {
        const msg = err.response?.data?.message || 'Errore durante la creazione.'
        error.value = msg
        toast.showToast(msg, 'error')
      }
      return { success: false, initiativeId: null }
    } finally {
      loading.value = false
    }
  }

  const checkUserCooldown = async () => {
    const userId = localStorage.getItem('tp_mock_id')
    if (!userId) return { allowed: true }

    try {
      const res = await axios.get(`${API_URL}/initiatives/cooldown`, {
        headers: { 'X-Mock-User-Id': userId },
      })
      return res.data
    } catch (err) {
      console.error('Errore check cooldown', err)
      return { allowed: true }
    }
  }

  // --- AZIONI ADMIN ---
  const fetchExpiringInitiatives = async (page = 1) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      const response = await axios.get(
        `${API_URL}/initiatives/admin/expiring?currentPage=${page}&objectsPerPage=5`,
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

      const newDate = new Date(currentExpirationDate)
      newDate.setDate(newDate.getDate() + 60)
      const formattedDate = newDate.toISOString().split('T')[0]

      await axios.patch(
        `${API_URL}/initiatives/${id}`,
        { expirationDate: formattedDate },
        { headers: { 'X-Mock-User-Id': userId } },
      )

      return true
    } catch (err) {
      console.error('Errore estensione scadenza:', err)
      throw err
    }
  }

  // Metodo per resettare lo store (utile per logout)
  const $reset = () => {
    initiatives.value = []
    homeInitiatives.value = []
    archiveInitiatives.value = []
    categories.value = []
    platforms.value = []
    followedIds.value = []
    signedIds.value = []
    loading.value = false
    homeLoading.value = false
    archiveLoading.value = false
    detailLoading.value = false
    isFetchingFollowed.value = false
    isFetchingSigned.value = false
    isFetchingFilters.value = false
    isFetchingInitiatives.value = false
    error.value = null
    currentPage.value = 1
    totalPages.value = 1
    totalObjects.value = 0
    console.log('🔄 InitiativeStore resettato')
  }

  return {
    initiatives,
    homeInitiatives,
    archiveInitiatives,
    categories,
    platforms,
    loading,
    homeLoading,
    archiveLoading,
    detailLoading,
    error,
    currentPage,
    totalPages,
    totalObjects,
    followedIds,
    followedInitiatives,
    signedIds,
    hasSigned,
    fetchUserSignedIds,
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
    $reset,
  }
})
