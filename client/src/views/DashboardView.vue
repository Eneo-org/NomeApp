<script setup>
import { ref, onMounted, watch } from 'vue'
import { useDashboardStore } from '../stores/dashboardStore'
import { useUserStore } from '../stores/userStore'
import { useRouter } from 'vue-router'
import { useInitiativeStore } from '../stores/initiativeStore'

const dashboardStore = useDashboardStore()
const userStore = useUserStore()
const router = useRouter()
const initiativeStore = useInitiativeStore()

// Tab attiva: 'followed' (Seguite), 'created' (Create), 'notifications' (Notifiche)
const activeTab = ref('followed')

// Funzione di caricamento intelligente
const loadTab = async () => {
  if (activeTab.value === 'notifications') {
    await dashboardStore.fetchNotifications()
  } else {
    // Passiamo il nome del tab come parametro 'relation' al backend
    await dashboardStore.fetchDashboardData(activeTab.value)
  }
}

// Ricarica i dati quando cambio tab
watch(activeTab, () => {
  loadTab()
})

onMounted(async () => {
  if (!userStore.isAuthenticated) {
    router.push('/login')
    return
  }
  await initiativeStore.fetchUserFollowedIds()

  loadTab()
})

// Funzione helper per le date
const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="dashboard-container">
    <div class="dash-header">
      <h1>👤 La mia Dashboard</h1>
      <p>Benvenuto, {{ userStore.user?.firstName }}!</p>
    </div>

    <div class="tabs">
      <button :class="{ active: activeTab === 'followed' }" @click="activeTab = 'followed'">
        ⭐ Seguite
      </button>
      <button :class="{ active: activeTab === 'created' }" @click="activeTab = 'created'">
        ✏️ Create da me
      </button>
      <button :class="{ active: activeTab === 'notifications' }" @click="activeTab = 'notifications'">
        🔔 Notifiche
        <span v-if="dashboardStore.notifications.some(n => !n.isRead)" class="dot"></span>
      </button>
    </div>

    <div class="content-area">
      <div v-if="dashboardStore.loading" class="loading">Caricamento in corso...</div>

      <div v-else-if="activeTab === 'notifications'">
        <div v-if="dashboardStore.notifications.length === 0" class="empty-msg">
          Non hai nuove notifiche.
        </div>

        <div v-for="notif in dashboardStore.notifications" :key="notif.id" class="notification-item"
          :class="{ unread: !notif.isRead }" @click="dashboardStore.markAsRead(notif.id)">
          <div class="notif-content">
            <p>{{ notif.text }}</p>
            <small>{{ formatDate(notif.creationDate) }}</small>
          </div>
          <div v-if="!notif.isRead" class="new-badge">NUOVA</div>
        </div>
      </div>

      <div v-else>
        <div v-if="dashboardStore.myInitiatives.length === 0" class="empty-msg">
          Nessuna iniziativa trovata in questa sezione.
        </div>

        <div class="dash-grid">
          <div v-for="item in dashboardStore.myInitiatives" :key="item.id" class="dash-card">
            <div class="dc-header">
              <span class="dc-status" :class="item.status?.toLowerCase()">{{ item.status }}</span>

              <button v-if="item.status === 'In corso'" class="follow-btn-mini"
                :class="{ 'active': initiativeStore.isFollowed(item.id) || activeTab === 'followed' }"
                @click.prevent="initiativeStore.toggleFollow(item.id, item.title)">
                ★
              </button>
            </div>
            <h3>{{ item.title }}</h3>
            <div class="dc-stats">
              <span>✍️ {{ item.signatures }} Firme</span>
            </div>
            <RouterLink :to="'/initiative/' + item.id" class="dc-link">Vedi Iniziativa →</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.dash-header {
  margin-bottom: 30px;
  border-bottom: 1px solid var(--card-border);
  padding-bottom: 20px;
}

/* TABS */
.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 25px;
  border-bottom: 1px solid var(--card-border);
}

.tabs button {
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  padding: 10px 20px;
  color: var(--secondary-text);
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
}

.tabs button.active {
  border-bottom-color: var(--accent-color);
  color: var(--accent-color);
}

.tabs button:hover {
  color: var(--text-color);
}

/* NOTIFICHE */
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
  border-left: 5px solid var(--accent-color);
  background: rgba(52, 152, 219, 0.1);
}

.notification-item:hover {
  background: var(--input-bg);
}

.new-badge {
  background: var(--accent-color);
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.dot {
  height: 8px;
  width: 8px;
  background-color: #e74c3c;
  border-radius: 50%;
  display: inline-block;
  margin-left: 5px;
  vertical-align: middle;
}

/* CARD INIZIATIVE DASHBOARD */
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.dash-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dc-status {
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  background: #7f8c8d;
  color: white;
}

.dc-status.in.corso {
  background: #3498db;
}

.dc-status.approvata {
  background: #27ae60;
}

.dc-link {
  margin-top: auto;
  color: var(--accent-color);
  text-decoration: none;
  font-weight: bold;
}

.empty-msg {
  text-align: center;
  color: var(--secondary-text);
  padding: 40px;
  font-style: italic;
}

.loading {
  text-align: center;
  padding: 20px;
}

.follow-btn-mini {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: #ccc;
}

.follow-btn-mini.active {
  color: #f1c40f;
}

.follow-btn-mini:hover {
  transform: scale(1.1);
}
</style>
