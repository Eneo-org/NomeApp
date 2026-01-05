<script setup>
import { ref, onMounted, watch } from 'vue'
import { useDashboardStore } from '../stores/dashboardStore'
import { useUserStore } from '../stores/userStore'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useRouter } from 'vue-router'
// Assicurati che questo file esista, altrimenti mettine uno nella cartella assets!
import defaultImage from '@/assets/placeholder-initiative.jpg';

const API_URL = 'http://localhost:3000';

const dashboardStore = useDashboardStore()
const userStore = useUserStore()
const initiativeStore = useInitiativeStore()
const router = useRouter()

const activeTab = ref('created')

// --- HELPER IMMAGINI AGGIORNATO ---
const getImageUrl = (item) => {
  // Cerchiamo l'immagine in tutti i posti possibili per essere sicuri
  const fileData = item.attachment || item.attachments;

  // Se non c'è nessun allegato, o se l'allegato non ha il percorso, usa default
  if (!fileData || !fileData.filePath) {
    return defaultImage;
  }

  // Se c'è, puliamo il percorso (fix per slash Windows \)
  const cleanPath = fileData.filePath.replace(/\\/g, '/');
  return `${API_URL}/${cleanPath}`;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const getStatusClass = (status) => {
  if (!status) return 'status-default';
  const s = status.toLowerCase();
  if (s === 'in corso') return 'status-active';
  if (s === 'approvata') return 'status-success';
  if (s === 'respinta') return 'status-danger';
  if (s === 'scaduta') return 'status-muted';
  return 'status-default';
};

// --- AZIONI ---
const handleSign = async (item) => {
  const result = await initiativeStore.signInitiative(item.id);
  if (result.success) item.signatures++;
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
      <button :class="{ active: activeTab === 'notifications' }" @click="activeTab = 'notifications'">
        🔔 Notifiche
        <span v-if="dashboardStore.notifications.some(n => !n.isRead)" class="dot"></span>
      </button>
    </div>

    <div class="results-area">
      <div v-if="dashboardStore.loading" class="loading-msg">Caricamento in corso...</div>

      <div v-else-if="activeTab === 'notifications'">
        <div v-if="dashboardStore.notifications.length === 0" class="no-results">
          <p>Non hai nuove notifiche.</p>
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
        <div v-if="dashboardStore.myInitiatives.length === 0" class="no-results">
          <p>Nessuna iniziativa trovata in questa sezione.</p>
        </div>

        <div v-else class="cards-container">
          <div v-for="item in dashboardStore.myInitiatives" :key="item.id" class="card">

            <div class="card-image-wrapper">
              <div v-if="item.platformId && item.platformId !== 1" class="source-badge external">
                🔗 {{ initiativeStore.getPlatformName(item.platformId) }}
              </div>
              <img :src="getImageUrl(item)" class="card-img" alt="Immagine iniziativa">
            </div>

            <div class="card-content">
              <div class="card-header">
                <h3>{{ item.title }}</h3>
                <div class="status-wrapper">
                  <span class="badge-status" :class="getStatusClass(item.status)">
                    {{ item.status ? item.status.toUpperCase() : 'N/A' }}
                  </span>
                  <button v-if="item.status && item.status.toLowerCase() === 'in corso'" class="follow-btn"
                    :class="{ 'active': initiativeStore.isFollowed(item.id) }"
                    @click.prevent="initiativeStore.toggleFollow(item.id, item.title)">
                    {{ initiativeStore.isFollowed(item.id) ? '⭐' : '☆' }}
                  </button>
                </div>
              </div>

              <div class="card-meta">
                <span>📍 <strong>{{ item.place || 'Trento' }}</strong></span>
                <span>🏷️ {{ initiativeStore.getCategoryName(item.categoryId) }}</span>
                <div class="date-row"><span>📅 {{ formatDate(item.creationDate) }}</span></div>
              </div>

              <div class="card-footer">
                <div class="signatures">
                  <strong>Firme: {{ item.signatures }}</strong>
                </div>
                <div class="actions">
                  <div v-if="!item.platformId || item.platformId === 1" class="internal-actions">
                    <RouterLink :to="'/initiative/' + item.id">
                      <button class="action-btn">Dettagli</button>
                    </RouterLink>

                    <button v-if="item.status && item.status.toLowerCase() === 'in corso' && activeTab !== 'created'"
                      @click="handleSign(item)" class="sign-btn">
                      ✍️ Firma
                    </button>
                  </div>

                  <a v-else :href="item.externalURL || '#'" target="_blank">
                    <button class="action-btn outline">Su {{ initiativeStore.getPlatformName(item.platformId) }}
                      ↗</button>
                  </a>
                </div>
              </div>
            </div>
          </div>

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

.card {
  display: flex;
  gap: 0;
  /* Rimosso gap per far attaccare immagine */
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  height: 180px;
  box-shadow: var(--card-shadow);
}

/* WRAPPER IMMAGINE: FISSO E PIENO */
.card-image-wrapper {
  flex: 0 0 240px;
  /* Larghezza fissa */
  background: #222;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* L'immagine riempie tutto lo spazio senza deformarsi */
  display: block;
}

.card-content {
  flex: 1;
  padding: 15px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.card-header h3 {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.2;
  color: var(--text-color);
}

.status-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
}

.status-active {
  background-color: #3498db;
}

.status-success {
  background-color: #27ae60;
}

.status-danger {
  background-color: #e74c3c;
}

.status-muted {
  background-color: #95a5a6;
}

.status-default {
  background-color: #7f8c8d;
}

.follow-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #777;
  transition: 0.2s;
  padding: 0;
}

.follow-btn.active {
  color: #f1c40f;
}

.follow-btn:hover {
  transform: scale(1.1);
  color: #f1c40f;
}

.card-meta {
  font-size: 0.9rem;
  color: var(--secondary-text);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.date-row {
  font-size: 0.85rem;
  color: #888;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.action-btn {
  background-color: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--header-border);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: 0.2s;
}

.action-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* Source Badge */
.source-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  background-color: #d32f2f;
  color: white;
  z-index: 2;
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

.dot {
  height: 8px;
  width: 8px;
  background-color: #e74c3c;
  border-radius: 50%;
  display: inline-block;
  margin-left: 5px;
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
