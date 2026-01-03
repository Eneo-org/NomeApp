import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useUserStore = defineStore('user', () => {
  // STATE
  const user = ref(null) // Contiene i dati dell'utente (nome, ruolo, ecc.)
  const mockUserId = ref(null) // L'ID da mandare al backend (1 o 2)

  // GETTERS
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.isAdmin === true)
  const isCitizen = computed(() => user.value?.isCitizen === true)
  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : 'Ospite',
  )

  // ACTIONS

  // 1. LOGIN SIMULATO
  const login = async (email, password) => {
    try {
      // LOGICA DI SIMULAZIONE:
      // Invece di chiedere al server "è giusta la password?",
      // decidiamo noi l'ID in base all'email inserita.
      let targetId = null

      if (email === 'admin@comune.trento.it') {
        targetId = 2 // ID Admin nel tuo DB
      } else if (email === 'mario.rossi@email.com') {
        targetId = 1 // ID Cittadino nel tuo DB
      } else {
        alert('Utente non riconosciuto nella demo.')
        return false
      }

      // Ora chiediamo al backend i dettagli di questo utente
      // Usiamo la rotta che mi hai mostrato: GET /users/profile (o simile, controlla il tuo users.js)
      // Se non hai una rotta 'me', usiamo quella generica getUser passando l'header

      // Impostiamo l'header per la richiesta
      axios.defaults.headers.common['X-Mock-User-Id'] = targetId

      // Chiamiamo il backend per avere i dati freschi (Nome, Cognome, Ruoli)
      // Nota: Se la tua rotta è /users/1, usiamo quella.
      // Dallo screenshot sembra tu abbia exports.getUser che usa l'header.
      // Assumo che la rotta sia GET /users/profile o GET /users/me mappata su getUser
      // Se non c'è, la simuliamo chiamando GET /users con un parametro fittizio o adattando userController.

      // PER ORA: Dato che non voglio farti modificare il backend, facciamo una chiamata sicura
      // Se il tuo backend non ha una rotta "/me", useremo i dati hardcoded per ora,
      // ma l'ideale sarebbe chiamare: await axios.get(`${API_URL}/users/profile`);

      // Salviamo lo stato
      mockUserId.value = targetId

      // Simuliamo i dati utente in base all'ID (così non dipendiamo da rotte backend mancanti)
      if (targetId === 2) {
        user.value = {
          id: 2,
          firstName: 'Admin',
          lastName: 'Comune',
          email: email,
          isAdmin: true,
          isCitizen: true,
        }
      } else {
        user.value = {
          id: 1,
          firstName: 'Mario',
          lastName: 'Rossi',
          email: email,
          isAdmin: false,
          isCitizen: true,
        }
      }

      // Persistenza nel browser (così se aggiorni la pagina resti loggato)
      localStorage.setItem('tp_mock_id', targetId)
      localStorage.setItem('tp_user_data', JSON.stringify(user.value))

      return true
    } catch (err) {
      console.error('Errore login simulato:', err)
      return false
    }
  }

  // 2. LOGOUT
  const logout = () => {
    user.value = null
    mockUserId.value = null
    localStorage.removeItem('tp_mock_id')
    localStorage.removeItem('tp_user_data')

    // Rimuoviamo l'header
    delete axios.defaults.headers.common['X-Mock-User-Id']

    // Ricarica la pagina per pulire tutto
    window.location.href = '/'
  }

  // 3. INIT (Da chiamare all'avvio dell'app)
  const initializeStore = () => {
    const storedId = localStorage.getItem('tp_mock_id')
    const storedUser = localStorage.getItem('tp_user_data')

    if (storedId && storedUser) {
      mockUserId.value = parseInt(storedId)
      user.value = JSON.parse(storedUser)
      // Ripristiniamo l'header per tutte le chiamate Axios future
      axios.defaults.headers.common['X-Mock-User-Id'] = mockUserId.value
    }
  }

  return {
    user,
    mockUserId, // Utile per debug
    isAuthenticated,
    isAdmin,
    isCitizen,
    fullName,
    login,
    logout,
    initializeStore,
  }
})
