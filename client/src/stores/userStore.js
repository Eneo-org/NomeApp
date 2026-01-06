import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useUserStore = defineStore('user', () => {
  // --- STATE ---
  const user = ref(null) // Oggetto utente reale dal DB
  const mockUserId = ref(null) // ID salvato

  // --- GETTERS ---
  const isAuthenticated = computed(() => !!user.value)
  // Nota: il backend ci restituisce 1/0 per i booleani, quindi usiamo !! per convertirli in true/false sicuri
  const isAdmin = computed(() => !!user.value?.isAdmin)
  const isCitizen = computed(() => !!user.value?.isCitizen)

  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : 'Ospite',
  )

  // --- ACTIONS ---

  // 1. LOGIN (Aggiornato con Luigi e chiamata reale)
  const login = async (email, password) => {
    try {
      // MAPPING EMAIL -> ID (Simulazione Auth)
      // Qui aggiungi i tuoi utenti di test
      const userMap = {
        'mario.rossi@email.com': 1,
        'admin@comune.trento.it': 2,
        'luigi@test.com': 3, // <--- NUOVO UTENTE LUIGI
      }

      const targetId = userMap[email]

      if (!targetId) {
        alert(
          'Utente non riconosciuto. Prova: mario.rossi@email.com, admin@comune.trento.it o luigi@test.com',
        )
        return false
      }

      // 1. Impostiamo l'header per axios
      axios.defaults.headers.common['X-Mock-User-Id'] = targetId
      mockUserId.value = targetId
      localStorage.setItem('tp_mock_id', targetId)

      // 2. CHIAMATA REALE AL BACKEND (Recuperiamo i dati veri: nome, ruolo, ecc.)
      // Questo usa la rotta /users/me che hai nel backend
      const response = await axios.get(`${API_URL}/users/me`)

      // 3. Salviamo nello stato i dati freschi dal DB
      user.value = response.data

      return true
    } catch (err) {
      console.error('Errore login:', err)
      alert('Impossibile recuperare i dati utente dal server.')
      logout() // Se fallisce, puliamo tutto
      return false
    }
  }

  // 2. LOGOUT
  const logout = () => {
    user.value = null
    mockUserId.value = null
    localStorage.removeItem('tp_mock_id')

    // Rimuoviamo header
    delete axios.defaults.headers.common['X-Mock-User-Id']

    // Ricarica per pulire lo stato di tutta l'app
    window.location.href = '/'
  }

  // 3. INITIALIZE (Chiamato da App.vue al refresh)
  const initializeStore = async () => {
    const storedId = localStorage.getItem('tp_mock_id')

    if (storedId) {
      // Ripristiniamo subito l'header per non fallire le chiamate
      mockUserId.value = parseInt(storedId)
      axios.defaults.headers.common['X-Mock-User-Id'] = mockUserId.value

      // Proviamo a scaricare i dati freschi dell'utente
      try {
        const response = await axios.get(`${API_URL}/users/me`)
        user.value = response.data
      } catch (err) {
        console.error('Sessione scaduta o utente non trovato:', err)
        logout() // Se l'ID salvato non è valido, facciamo logout
      }
    }
  }

  // --- AZIONE ADMIN: Ottieni lista Admin ---
  const fetchAdminUsers = async (page = 1, fiscalCode = '') => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      // Costruiamo la query string
      let query = `${API_URL}/users/admin/list?currentPage=${page}&objectsPerPage=10`
      if (fiscalCode) query += `&fiscalCode=${fiscalCode}`

      const response = await axios.get(query, {
        headers: { 'X-Mock-User-Id': storedId },
      })

      return response.data // Ritorna { data: [...], meta: {...} }
    } catch (err) {
      console.error('Errore fetchAdminUsers:', err)
      return null
    }
  }

  // Non dimenticare di aggiungere 'fetchAdminUsers' al return finale!

  return {
    user,
    mockUserId,
    isAuthenticated,
    isAdmin,
    isCitizen,
    fullName,
    login,
    logout,
    initializeStore,
    fetchAdminUsers,
  }
})
