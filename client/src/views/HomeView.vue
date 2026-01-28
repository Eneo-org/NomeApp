<script setup>
import { onMounted } from 'vue'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'
import { useUserStore } from '../stores/userStore'
import { useImage } from '@/composables/useImage';
import ParticipatoryBudgetCard from '@/components/ParticipatoryBudgetCard.vue'
import { useRouter } from 'vue-router';
import { useToastStore } from '../stores/toastStore';
import { formatCooldownTime } from '@/utils/dateUtils';

const initiativeStore = useInitiativeStore()
const budgetStore = useParticipatoryBudgetStore()
const userStore = useUserStore()
const router = useRouter();
const toast = useToastStore();
const { getImageUrl } = useImage();

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}

// --- INIT ---
onMounted(async () => {
  loadData()
  budgetStore.fetchActiveBudget()
  if (userStore.isAuthenticated) {
    await initiativeStore.fetchUserFollowedIds();
  }
})

const loadData = async () => {
  await initiativeStore.fetchInitiatives(
    1,
    'signatures',
    { status: 'In corso' }
  );
};

// --- LOGICA STELLINA ---
const handleStarClick = async (item) => {
  if (!userStore.isAuthenticated) {
    if (confirm("Devi accedere per seguire le iniziative. Vuoi andare al login?")) {
      router.push('/login');
    }
    return;
  }
  await initiativeStore.toggleFollow(item.id, item.title);
};

// --- LOGICA CREAZIONE ---
const handleCreateClick = async () => {
  if (!userStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  const status = await initiativeStore.checkUserCooldown();

  if (status && status.allowed === false) {
    const timeString = formatCooldownTime(status.remainingMs);
    toast.showToast(
      `⏳ Devi attendere ancora ${timeString} prima di creare una nuova iniziativa.`,
      'error',
      { duration: 6000 }
    );
  } else {
    router.push('/create');
  }
};

const getStatusClass = (status) => {
  if (!status) return 'status-default';
  const s = status.toLowerCase();
  if (s === 'in corso') return 'status-active';
  if (s === 'approvata') return 'status-success';
  if (s === 'respinta') return 'status-danger';
  if (s === 'scaduta') return 'status-muted';
  return 'status-default';
};
</script>

<template>
  <div class="home-wrapper">

    <div class="budget-section">
      <ParticipatoryBudgetCard />
    </div>

    <div class="main-layout">
      <main class="content-area">

        <div class="results-header">
          <h2>Iniziative attive più popolari</h2>
        </div>

        <div v-if="initiativeStore.loading" class="loading-container">
          <div class="spinner"></div>
          <p>Caricamento in corso...</p>
        </div>

        <div v-else class="cards-container">
          <div v-for="item in initiativeStore.initiatives" :key="item.id" class="card">

            <div class="card-image-wrapper">
              <div v-if="item.platformId !== 1" class="source-badge external">
                {{ initiativeStore.getPlatformName(item.platformId) }} ↗
              </div>
              <img :src="getImageUrl(item)" class="card-img" alt="Immagine iniziativa">
            </div>

            <div class="card-content">

              <div class="card-top-row">
                <div class="status-badge-mini" :class="getStatusClass(item.status)">
                  <span class="status-dot"></span>
                  {{ item.status }}
                </div>

                <button v-if="item.status && item.status.toLowerCase() === 'in corso'" class="follow-btn-wrapper"
                  @click.prevent="handleStarClick(item)" title="Segui questa iniziativa">
                  <span v-if="initiativeStore.isFollowed(item.id)" class="followed-badge">★ Segui già</span>
                  <span v-else class="unfollowed-badge">☆ Segui aggiornamenti</span>
                </button>
              </div>

              <div class="card-header">
                <h3>{{ item.title }}</h3>
                <span class="category-tag">{{ initiativeStore.getCategoryName(item.categoryId) }}</span>
              </div>

              <div class="card-meta">
                <span>📍 {{ item.place || 'Trento' }}</span>
                <span>📅 {{ formatDate(item.creationDate) }}</span>
              </div>

              <div class="card-footer">
                <span class="signatures-text">Firme raccolte: {{ item.signatures }}</span>

                <div class="actions">
                  <div v-if="item.platformId === 1">
                    <RouterLink :to="'/initiative/' + item.id">
                      <button class="action-btn">Vedi dettagli</button>
                    </RouterLink>
                  </div>
                  <a v-else :href="item.externalURL || '#'" target="_blank">
                    <button class="external-btn">Vedi su {{ initiativeStore.getPlatformName(item.platformId) }}
                      ↗</button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* --- LAYOUT GENERALE --- */
.home-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  color: var(--text-color);
  font-family: 'Segoe UI', Roboto, sans-serif;
}

/* --- BUDGET SECTION --- */
.budget-section {
  margin-bottom: 40px;
}

/* --- MAIN GRID --- */
.main-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: start;
}

/* --- HEADER RISULTATI --- */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-header h2 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
}

/* --- LISTA CARD --- */
.cards-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.card {
  display: flex;
  gap: 0;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  min-height: 180px;
}

.card-image-wrapper {
  flex: 0 0 230px;
  background: #2c3e50;
  position: relative;
  overflow: hidden;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* SOURCE BADGE */
.source-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.source-badge.external {
  background-color: #e74c3c;
  color: white;
}

/* CONTENUTO CARD */
.card-content {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-badge-mini {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: white;
}

.status-badge-mini .status-dot {
  background: white;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

/* Colori status */
.status-active {
  background: #3498db;
}

.status-success {
  background: #27ae60;
}

.status-danger {
  background: #e74c3c;
}

.status-muted {
  background: #95a5a6;
}

.status-default {
  background: #7f8c8d;
}

.card-header {
  margin-bottom: 8px;
}

.card-header h3 {
  margin: 0 0 5px 0;
  font-size: 1.5rem;
  line-height: 1.2;
  color: var(--text-color);
  font-weight: 800;
}

.category-tag {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--secondary-text);
  background: var(--input-bg);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--header-border);
}

.follow-btn-wrapper {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.followed-badge,
.unfollowed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.85rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.followed-badge {
  border: 2px solid #f1c40f;
  color: #f39c12;
  background: rgba(241, 196, 15, 0.1);
}

.unfollowed-badge {
  border: 1px solid var(--secondary-text);
  color: var(--secondary-text);
  background: transparent;
}

.follow-btn-wrapper:hover .unfollowed-badge {
  border-color: #f1c40f;
  color: #f1c40f;
  background: rgba(241, 196, 15, 0.05);
}

/* META DATA */
.card-meta {
  display: flex;
  gap: 20px;
  font-size: 0.85rem;
  color: var(--secondary-text);
  margin-bottom: 12px;
}

/* FOOTER CARD */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid var(--header-border);
}

.signatures-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

.action-btn,
.external-btn {
  background: transparent;
  border: 1px solid var(--secondary-text);
  color: var(--text-color);
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.action-btn:hover,
.external-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(0, 0, 0, 0.02);
}

/* LOADING & EMPTY */
.loading-container,
.no-results {
  text-align: center;
  padding: 60px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--card-border);
  color: var(--secondary-text);
}

.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top: 3px solid var(--accent-color);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .card {
    flex-direction: column;
    height: auto;
  }

  .card-image-wrapper {
    flex: none;
    height: 180px;
    width: 100%;
  }
}
</style>
