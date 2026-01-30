<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useDashboardStore } from '../stores/dashboardStore'
import { useUserStore } from '../stores/userStore'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useRouter } from 'vue-router'
import InitiativeCard from '@/components/InitiativeCard.vue'

const dashboardStore = useDashboardStore()
const userStore = useUserStore()
const initiativeStore = useInitiativeStore()
const router = useRouter()

const activeTab = ref('created')

// Calcola il numero di notifiche non lette in tempo reale
const unreadCount = computed(() => {
  return dashboardStore.notifications.filter(n => !n.isRead).length;
});

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// --- AZIONI ---
const handleNotificationClick = async (notif) => {
  // Segna la notifica come letta in background
  await dashboardStore.markAsRead(notif.id);

  // Se la notifica ha un ID iniziativa, reindirizza l'utente
  if (notif.initiativeId) {
    router.push(`/initiative/${notif.initiativeId}`);
  }
};

// --- CARICAMENTO DATI ---
const loadData = async () => {
  if (!userStore.isAuthenticated) {
    router.push('/')
    return
  }
  if (activeTab.value === 'notifications') {
    await dashboardStore.fetchNotifications()
  } else {
    await dashboardStore.fetchDashboardData(activeTab.value, dashboardStore.currentPage)
  }
}

// Paginazione
const nextPage = async () => {
  if (dashboardStore.currentPage < dashboardStore.totalPages) {
    await dashboardStore.fetchDashboardData(activeTab.value, dashboardStore.currentPage + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const prevPage = async () => {
  if (dashboardStore.currentPage > 1) {
    await dashboardStore.fetchDashboardData(activeTab.value, dashboardStore.currentPage - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

watch(activeTab, async () => {
  if (activeTab.value === 'notifications') {
    loadData()
  } else {
    await dashboardStore.fetchDashboardData(activeTab.value, 1)
  }
})

onMounted(async () => {
  await Promise.all([
    loadData(),
    initiativeStore.fetchFiltersData(),
    initiativeStore.fetchUserFollowedIds(),
    dashboardStore.fetchNotifications()
  ])
})
</script>

<template>
  <div class="dashboard-container">

    <div class="dashboard-header">
      <h1>Ciao, {{ userStore.user?.name || userStore.user?.firstName || 'Cittadino' }}!</h1>
      <p>Benvenuto nella tua area personale.</p>
    </div>

    <div class="tabs">
      <button :class="{ active: activeTab === 'created' }" @click="activeTab = 'created'">
        ✏️ Le mie Proposte
      </button>
      <button :class="{ active: activeTab === 'signed' }" @click="activeTab = 'signed'">
        ✍️ Firmate
      </button>
      <button :class="{ active: activeTab === 'followed' }" @click="activeTab = 'followed'">
        ⭐ Seguite
      </button>
      <button class="tab-btn-wrapper" :class="{ active: activeTab === 'notifications' }"
        @click="activeTab = 'notifications'">
        🔔 Notifiche

        <span v-if="unreadCount > 0" class="notification-badge">
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </button>
    </div>

    <div class="results-area">
      <div v-if="dashboardStore.loading" class="loading-msg">Caricamento in corso...</div>

      <div v-else-if="activeTab === 'notifications'">
        <div v-if="dashboardStore.notifications.length === 0" class="no-results">
          <p>Non hai nuove notifiche.</p>
        </div>
        <div v-for="notif in dashboardStore.notifications" :key="notif.id" class="notification-item"
          :class="{ unread: !notif.isRead }" @click="handleNotificationClick(notif)">
          <div class="notif-content">
            <p>{{ notif.text }}</p>
            <small>{{ formatDate(notif.creationDate) }}</small>
          </div>
          <div v-if="!notif.isRead" class="new-badge">NUOVA</div>
        </div>
      </div>

      <div v-else>
        <div v-if="dashboardStore.myInitiatives.length === 0" class="no-results">
          <p>Nessuna iniziativa trovata in questa sezione.</p>
        </div>

        <div v-else class="cards-container">
          <InitiativeCard 
            v-for="item in dashboardStore.myInitiatives" 
            :key="item.id" 
            :item="item" 
          />

          <div class="pagination-controls" v-if="dashboardStore.totalPages > 1">
            <button @click="prevPage" :disabled="dashboardStore.currentPage === 1" class="page-btn">←</button>
            <span class="page-info">Pagina {{ dashboardStore.currentPage }} di {{ dashboardStore.totalPages }}</span>
            <button @click="nextPage" :disabled="dashboardStore.currentPage >= dashboardStore.totalPages"
              class="page-btn">→</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* STILI IDENTICI ALLA HOME MA OTTIMIZZATI */
.dashboard-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  color: var(--text-color);
}

.dashboard-header {
  margin-bottom: 30px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 15px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 25px;
  border-bottom: 1px solid var(--header-border);
  overflow-x: auto;
}

.tabs button {
  background: none;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 1rem;
  color: var(--secondary-text);
  border-bottom: 3px solid transparent;
  white-space: nowrap;
  transition: 0.2s;
}

.tabs button:hover {
  color: var(--text-color);
}

.tabs button.active {
  border-bottom: 3px solid var(--accent-color);
  color: var(--accent-color);
  font-weight: bold;
}

/* CARD STYLE */
.cards-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Notifiche & Paginazione */
.notification-item {
  padding: 15px;
  border: 1px solid var(--card-border);
  margin-bottom: 10px;
  border-radius: 8px;
  cursor: pointer;
  background: var(--card-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-item.unread {
  border-left: 4px solid var(--accent-color);
  background: rgba(52, 152, 219, 0.05);
}

.new-badge {
  background: var(--accent-color);
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

/* In UserDashboard.vue */

.tab-btn-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Assicuriamo che il badge non venga tagliato se esce dai bordi */
  overflow: visible; 
}

.notification-badge {
  position: absolute;
  /* Ho cambiato da -5px a -1px per abbassarlo. 
     Se lo vuoi ancora più in basso, prova a mettere 0px o 2px */
  top: -1px; 
  
  /* L'ho spostato un po' più a destra (-12px) così non copre la "e" finale */
  right: -12px; 
  
  z-index: 10;

  background-color: #ef4444;
  color: white;

  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  
  border-radius: 12px;
  
  display: flex;
  align-items: center;
  justify-content: center;

  border: 2px solid var(--bg-color); 
  box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);
  
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Animazione carina quando appare */
@keyframes popIn {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
  align-items: center;
}

.page-btn {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-color);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-results {
  text-align: center;
  color: var(--secondary-text);
  padding: 40px;
  border: 1px dashed var(--header-border);
  border-radius: 12px;
}

.sign-btn {
  background-color: #2c3e50;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
  margin-left: 8px;
}

.sign-btn:hover {
  background-color: var(--accent-color);
}

@media (max-width: 650px) {
  .card {
    flex-direction: column;
    height: auto;
  }

  .card-image-wrapper {
    width: 100%;
    height: 180px;
    flex: none;
  }

  .card-content {
    padding: 15px;
  }
}
</style>
