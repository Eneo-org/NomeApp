import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useUserStore = defineStore('user', () => {
  // --- STATE ---
  const user = ref(null)
  const mockUserId = ref(null) // Manteniamo per compatibilità con il tuo backend attuale

  // Stato temporaneo per la registrazione (step intermedio)
  const tempRegistrationData = ref(null)

  // --- GETTERS ---
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => !!user.value?.isAdmin)
  const isCitizen = computed(() => !!user.value?.isCitizen)
  // Esempio: può votare se è cittadino (e magari maggiorenne, ma per ora basta questo)
  const canVote = computed(() => !!user.value?.isCitizen)

  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : 'Ospite',
  )

  // --- ACTIONS ---

  // Helper per salvare i dati utente e impostare gli header (DRY)
  const setUserData = (userData) => {
    localStorage.setItem('tp_mock_id', userData.id)
    axios.defaults.headers.common['X-Mock-User-Id'] = userData.id
    mockUserId.value = userData.id
    user.value = userData
  }

  // 1. LOGIN CON GOOGLE
  const loginWithGoogle = async (googleToken) => {
    try {
      // Chiamata al backend per verificare il token Google
      const response = await axios.post(`${API_URL}/auth/google`, {
        tokenId: googleToken,
      })

      const data = response.data

      if (data.status === 'LOGIN_SUCCESS') {
        // Caso A: Utente già registrato nel DB
        setUserData(data.user)
        return true
      }

      return false
    } catch (err) {
      // Caso 404: Utente non trovato, serve registrazione
      if (err.response?.status === 404 && err.response?.data?.status === 'NEED_REGISTRATION') {
        tempRegistrationData.value = {
          token: googleToken,
          ...err.response.data.googleData, // email, nome, cognome da google
        }
        return 'REGISTER' // Ritorniamo una stringa specifica per la View
      }

      console.error('Errore loginWithGoogle:', err)
      return false
    }
  }

  // 1b. LOGIN DOCENTI (Account test)
  const loginWithTeacherSecret = async (secret, accountKey) => {
    try {
      const response = await axios.post(`${API_URL}/auth/teacher-login`, {
        secret,
        accountKey,
      })

      const data = response.data

      if (data.status === 'LOGIN_SUCCESS') {
        setUserData(data.user)
        return true
      }

      return false
    } catch (err) {
      console.error('Errore loginWithTeacherSecret:', err)
      throw err.response?.data?.message || 'Errore login docenti'
    }
  }

  // 2. INVIO OTP (Fase 2 Registrazione)
  const sendOtp = async (email) => {
    try {
      await axios.post(`${API_URL}/auth/otp`, { email })
      return true
    } catch (err) {
      console.error('Errore invio OTP:', err)
      throw err.response?.data?.message || 'Errore invio codice'
    }
  }

  // 3. REGISTRAZIONE FINALE (Fase 3 Registrazione)
  const registerUser = async (email, otp) => {
    try {
      if (!tempRegistrationData.value) throw new Error('Dati sessione mancanti')

      const response = await axios.post(`${API_URL}/auth/register`, {
        googleToken: tempRegistrationData.value.token,
        email: email,
        otp: otp,
      })

      if (response.data.status === 'REGISTRATION_SUCCESS') {
        setUserData(response.data.user)
        tempRegistrationData.value = null // Pulizia dati temporanei
        return true
      }
      return false
    } catch (err) {
      console.error('Errore registrazione:', err)
      throw err.response?.data?.message || 'Errore validazione codice'
    }
  }

  // 4. LOGOUT
  const logout = () => {
    user.value = null
    mockUserId.value = null
    tempRegistrationData.value = null

    localStorage.removeItem('tp_mock_id')
    delete axios.defaults.headers.common['X-Mock-User-Id']

    // Reset degli altri store per pulire la cache
    try {
      // Importiamo dinamicamente per evitare circular dependencies
      const { useInitiativeStore } = require('./initiativeStore')
      const initiativeStore = useInitiativeStore()
      initiativeStore.$reset()
    } catch (e) {
      console.warn('Impossibile resettare initiativeStore:', e)
    }

    // Redirect forzato o gestito dal router
    window.location.href = '/'
  }

  // 5. INITIALIZE (Al refresh della pagina)
  const initializeStore = async () => {
    const storedId = localStorage.getItem('tp_mock_id')

    if (storedId) {
      mockUserId.value = parseInt(storedId)
      axios.defaults.headers.common['X-Mock-User-Id'] = mockUserId.value

      try {
        const response = await axios.get(`${API_URL}/users/me`)
        user.value = response.data
      } catch (err) {
        console.error('Sessione scaduta o invalida:', err)
        // Se il token/id non è più valido, facciamo logout pulito
        logout()
      }
    }
  }

  // --- GESTIONE ADMIN ---

  const fetchAdminUsers = async (page = 1, fiscalCode = '') => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      const params = {
        currentPage: page,
        objectsPerPage: 10,
        isAdmin: true,
        ...(fiscalCode && { fiscalCode }),
      }

      const response = await axios.get(`${API_URL}/users`, {
        params,
        headers: { 'X-Mock-User-Id': storedId },
      })
      return response.data
    } catch (err) {
      console.error('Errore fetchAdminUsers:', err)
      return null
    }
  }

  const findUserByFiscalCode = async (fiscalCode) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      const response = await axios.get(`${API_URL}/users`, {
        params: { fiscalCode },
        headers: { 'X-Mock-User-Id': storedId },
      })
      return response.data
    } catch (err) {
      if (err.response && err.response.status === 404) return null
      console.error('Errore ricerca CF:', err)
      return null
    }
  }

  const promoteToAdmin = async (userId) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      await axios.patch(
        `${API_URL}/users/${userId}`,
        { isAdmin: true },
        { headers: { 'X-Mock-User-Id': storedId } },
      )
      return true
    } catch (err) {
      console.error('Errore promozione:', err)
      return false
    }
  }

  const revokeAdminRole = async (userId) => {
    try {
      const storedId = localStorage.getItem('tp_mock_id')
      await axios.patch(
        `${API_URL}/users/${userId}`,
        { isAdmin: false },
        { headers: { 'X-Mock-User-Id': storedId } },
      )
      return true
    } catch (err) {
      console.error('Errore revoca:', err)
      return false
    }
  }

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
      return false
    }
  }

  return {
    // State
    user,
    mockUserId,
    tempRegistrationData,

    // Getters
    isAuthenticated,
    isAdmin,
    isCitizen,
    canVote,
    fullName,

    // Actions
    loginWithGoogle,
    loginWithTeacherSecret,
    sendOtp,
    registerUser,
    logout,
    initializeStore,

    // Admin Actions
    fetchAdminUsers,
    findUserByFiscalCode,
    promoteToAdmin,
    revokeAdminRole,
    preAuthorizeAdmin,
  }
})
