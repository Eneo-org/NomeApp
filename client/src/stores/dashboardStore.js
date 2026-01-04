import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useDashboardStore = defineStore('dashboard', () => {
  // --- STATE ---
  const myInitiatives = ref([]) // Lista iniziative (create, seguite o firmate)
  const notifications = ref([]) // Lista notifiche
  const loading = ref(false)

  // Paginazione Dashboard
  const currentPage = ref(1)
  const totalPages = ref(1)

  // --- ACTIONS ---

  // 1. Carica lista iniziative
  // relation può essere: 'created', 'followed', 'signed'
  const fetchDashboardData = async (relation = 'created', page = 1) => {
    loading.value = true
    const userId = localStorage.getItem('tp_mock_id')

    try {
      // NOTA: L'URL punta a /users/me/initiatives come definito nel tuo backend
      const res = await axios.get(`${API_URL}/users/me/initiatives`, {
        params: { relation, currentPage: page, objectsPerPage: 5 },
        headers: { 'X-Mock-User-Id': userId },
      })

      myInitiatives.value = res.data.data

      if (res.data.meta) {
        currentPage.value = res.data.meta.currentPage
        totalPages.value = res.data.meta.totalPages
      }
    } catch (err) {
      console.error('Errore dashboard:', err)
    } finally {
      loading.value = false
    }
  }

  // 2. Carica Notifiche
  const fetchNotifications = async () => {
    const userId = localStorage.getItem('tp_mock_id')
    try {
      // URL aggiornato: /users/me/notifications
      const res = await axios.get(`${API_URL}/users/me/notifications`, {
        headers: { 'X-Mock-User-Id': userId },
      })
      notifications.value = res.data.data
    } catch (err) {
      console.error('Errore notifiche:', err)
    }
  }

  // 3. Segna notifica come letta
  const markAsRead = async (id) => {
    const userId = localStorage.getItem('tp_mock_id')
    try {
      // URL aggiornato: /users/me/notifications/:id
      await axios.patch(
        `${API_URL}/users/me/notifications/${id}`,
        { isRead: true },
        { headers: { 'X-Mock-User-Id': userId } },
      )

      // Aggiornamento ottimistico (senza ricaricare tutto)
      const notif = notifications.value.find((n) => n.id === id)
      if (notif) notif.isRead = true
    } catch (err) {
      console.error('Errore lettura notifica:', err)
    }
  }

  return {
    myInitiatives,
    notifications,
    loading,
    currentPage,
    totalPages,
    fetchDashboardData,
    fetchNotifications,
    markAsRead,
  }
})
