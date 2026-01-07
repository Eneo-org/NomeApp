import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useUserStore = defineStore('user', () => {
  // --- STATE ---
  const user = ref(null)
  const mockUserId = ref(null)

  // --- GETTERS ---
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => !!user.value?.isAdmin)
  const isCitizen = computed(() => !!user.value?.isCitizen)

  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : 'Ospite',
  )

  // --- ACTIONS ---

  // 1. LOGIN
  const login = async (email, password) => {
    try {
      const userMap = {
        'mario.rossi@email.com': 1,
        'admin@comune.trento.it': 2,
        'luigi@test.com': 3,
      }

      const targetId = userMap[email]

      if (!targetId) {
        alert('Utente non riconosciuto.')
        return false
      }

      axios.defaults.headers.common['X-Mock-User-Id'] = targetId
      mockUserId.value = targetId
      localStorage.setItem('tp_mock_id', targetId)

      const response = await axios.get(`${API_URL}/users/me`)
      user.value = response.data

      return true
    } catch (err) {
      console.error('Errore login:', err)
      alert('Impossibile recuperare i dati utente dal server.')
      logout()
      return false
    }
  }

  const loginWithGoogle = async (googleToken) => {
    try {
      // Inviamo il token al backend per la verifica
      const response = await axios.post(`${API_URL}/auth/google`, {
        token: googleToken,
      })

      const userData = response.data.user

      // Simuliamo la sessione salvando l'ID (come facevamo prima)
      localStorage.setItem('tp_mock_id', userData.id)
      axios.defaults.headers.common['X-Mock-User-Id'] = userData.id
      mockUserId.value = userData.id
      user.value = userData

      return true
    } catch (err) {
      console.error('Login Google fallito:', err)
      return false
    }
  }

  // 2. LOGOUT
  const logout = () => {
    user.value = null
    mockUserId.value = null
    localStorage.removeItem('tp_mock_id')
    delete axios.defaults.headers.common['X-Mock-User-Id']
    window.location.href = '/'
  }

  // 3. INITIALIZE
  const initializeStore = async () => {
    const storedId = localStorage.getItem('tp_mock_id')
    if (storedId) {
      mockUserId.value = parseInt(storedId)
      axios.defaults.headers.common['X-Mock-User-Id'] = mockUserId.value
      try {
        const response = await axios.get(`${API_URL}/users/me`)
        user.value = response.data
      } catch (err) {
        console.error('Sessione scaduta:', err)
        logout()
      }
    }
  }

  // --- GESTIONE ADMIN ---

  const fetchAdminUsers = async (page = 1, fiscalCode = '') => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      let query = `${API_URL}/users/admin/list?currentPage=${page}&objectsPerPage=10`
      if (fiscalCode) query += `&fiscalCode=${fiscalCode}`

      const response = await axios.get(query, {
        headers: { 'X-Mock-User-Id': storedId },
      })
      return response.data
    } catch (err) {
      console.error('Errore fetchAdminUsers:', err)
      return null
    }
  }

  // 4. CERCA UTENTE PER CF
  const findUserByFiscalCode = async (fiscalCode) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      const response = await axios.get(`${API_URL}/users/search`, {
        params: { fiscalCode },
        headers: { 'X-Mock-User-Id': storedId },
      })
      return response.data // Ritorna oggetto utente
    } catch (err) {
      if (err.response && err.response.status === 404) return null // Non trovato
      console.error('Errore ricerca CF:', err)
      return null
    }
  }

  // 5. PROMUOVI A ADMIN (IS_ADMIN = 1)
  const promoteToAdmin = async (userId) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      await axios.patch(
        `${API_URL}/users/${userId}/role`,
        { isAdmin: true },
        { headers: { 'X-Mock-User-Id': storedId } },
      )
      return true
    } catch (err) {
      console.error('Errore promozione:', err)
      alert('Errore durante la promozione.')
      return false
    }
  }

  // 6. REVOCA ADMIN (IS_ADMIN = 0)
  const revokeAdminRole = async (userId) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      await axios.patch(
        `${API_URL}/users/${userId}/role`,
        { isAdmin: false },
        { headers: { 'X-Mock-User-Id': storedId } },
      )
      return true
    } catch (err) {
      console.error('Errore revoca:', err)
      alert('Errore durante la rimozione del ruolo.')
      return false
    }
  }

  // 7. PRE-AUTORIZZA ADMIN (IS_ADMIN = 1, IS_CITTADINO = 0)
  const preAuthorizeAdmin = async (fiscalCode) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      await axios.post(
        `${API_URL}/users/admin/pre-authorize`,
        { fiscalCode },
        { headers: { 'X-Mock-User-Id': storedId } },
      )
      return true
    } catch (err) {
      console.error('Errore pre-autorizzazione:', err)
      alert('Errore creazione utente pre-autorizzato.')
      return false
    }
  }

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
    findUserByFiscalCode,
    promoteToAdmin,
    revokeAdminRole,
    preAuthorizeAdmin,
    loginWithGoogle,
  }
})
