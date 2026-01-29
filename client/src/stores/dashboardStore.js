import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const useDashboardStore = defineStore('dashboard', () => {
  // --- STATE ---
  const myInitiatives = ref([]) // Lista iniziative utente
  const expiringInitiatives = ref([]) // NUOVO: Lista scadenze admin
  const notifications = ref([]) // Lista notifiche
  const loading = ref(false)

  // Paginazione Dashboard
  const currentPage = ref(1)
  const totalPages = ref(1)

  // --- ACTIONS ---

  // 1. Carica lista iniziative (Utente)
  const fetchDashboardData = async (relation = 'created', page = 1) => {
    loading.value = true
    const userId = localStorage.getItem('tp_mock_id')

    try {
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

  // 2. NUOVO: Carica Iniziative in Scadenza (Admin)
  // Usa l'endpoint generico /initiatives filtrando per quelle attive
  const fetchExpiringInitiatives = async () => {
    loading.value = true
    const userId = localStorage.getItem('tp_mock_id')
    try {
      const res = await axios.get(`${API_URL}/initiatives`, {
        params: {
          status: 'In corso', // Prendi solo quelle attive
          sortBy: 'expirationDate', // Ordina per scadenza
          order: 'asc', // Le più vicine per prime
          objectsPerPage: 10, // Limite (opzionale)
        },
        headers: { 'X-Mock-User-Id': userId },
      })
      expiringInitiatives.value = res.data.data || []
    } catch (err) {
      console.error('Errore caricamento scadenze:', err)
    } finally {
      loading.value = false
    }
  }

  // 3. Carica Notifiche
  const fetchNotifications = async () => {
    const userId = localStorage.getItem('tp_mock_id')
    try {
      const res = await axios.get(`${API_URL}/users/me/notifications`, {
        headers: { 'X-Mock-User-Id': userId },
      })
      notifications.value = res.data.data
    } catch (err) {
      console.error('Errore notifiche:', err)
    }
  }

  const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length);

  // 4. Segna notifica come letta
  const markAsRead = async (id) => {
    const userId = localStorage.getItem('tp_mock_id')
    try {
      await axios.patch(
        `${API_URL}/users/me/notifications/${id}`,
        { isRead: true },
        { headers: { 'X-Mock-User-Id': userId } },
      )

      const notif = notifications.value.find((n) => n.id === id)
      if (notif) notif.isRead = true
    } catch (err) {
      console.error('Errore lettura notifica:', err)
    }
  }

  // 5. Segna tutte le notifiche come lette
  const markAllAsRead = async () => {
    const userId = localStorage.getItem('tp_mock_id');
    try {
      await axios.patch(
        `${API_URL}/users/me/notifications/mark-all-as-read`,
        {},
        { headers: { 'X-Mock-User-Id': userId } },
      );
      notifications.value.forEach(n => n.isRead = true);
    } catch (err) {
      console.error('Errore nel segnare tutte le notifiche come lette:', err);
    }
  };

  return {
    myInitiatives,
    expiringInitiatives, // Esportiamo la nuova lista
    notifications,
    loading,
    currentPage,
    totalPages,
    unreadCount,
    fetchDashboardData,
    fetchExpiringInitiatives, // Esportiamo la nuova funzione
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  }
})
