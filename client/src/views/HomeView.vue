<script setup>
import { ref, onMounted, watch } from 'vue'
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

// --- STATO PAGINA ---
const page = ref(1);
const sort = ref('signatures');
const filters = ref({
  search: '',
  category: '',
  platform: '',
  status: 'In corso'
});

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}

// --- INIT ---
onMounted(async () => {
  await initiativeStore.fetchFiltersData()
  loadData()
  budgetStore.fetchActiveBudget()
  if (userStore.isAuthenticated) {
    await initiativeStore.fetchUserFollowedIds();
  }
})

const loadData = async () => {
  await initiativeStore.fetchInitiatives(page.value, sort.value, filters.value);
};

// --- NAVIGAZIONE ---
const nextPage = () => {
  if (initiativeStore.currentPage < initiativeStore.totalPages) {
    page.value++;
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const prevPage = () => {
  if (page.value > 1) {
    page.value--;
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const applyFilters = () => {
  initiativeStore.currentPage = 1
  page.value = 1;
  loadData()
}

const resetFilters = () => {
  filters.value = {
    search: '',
    category: '',
    platform: '',
    status: 'In corso'
  }
  applyFilters()
}

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

watch(() => filters.value.category, applyFilters)
watch(() => filters.value.platform, applyFilters)
</script>

<template>
  <div class="home-wrapper">

    <div class="hero-section">
      <div class="search-hero">
        <input v-model="filters.search" type="text" placeholder="🔍 Cerca iniziative, quartieri, temi..."
          @keyup.enter="applyFilters">
        <button @click="applyFilters" class="search-btn">Cerca</button>
      </div>
    </div>

    <div class="budget-section">
      <ParticipatoryBudgetCard />
    </div>

    <div class="main-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h3>Filtra Risultati</h3>
          <button @click="resetFilters" class="reset-link" title="Rimuovi tutti i filtri">Resetta</button>
        </div>

        <div class="filter-group">
          <label>Categoria</label>
          <div class="select-wrapper">
            <select v-model="filters.category" @change="applyFilters">
              <option value="">Tutte le categorie</option>
              <option v-for="cat in initiativeStore.categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="filter-group">
          <label>Piattaforma</label>
          <div class="select-wrapper">
            <select v-model="filters.platform" @change="applyFilters">
              <option value="">Tutte le piattaforme</option>
              <option v-for="p in initiativeStore.platforms" :key="p.id" :value="p.id">
                {{ p.platformName }}
              </option>
            </select>
          </div>
        </div>

        <div class="sidebar-actions" v-if="userStore.isAuthenticated">
          <button @click="handleCreateClick" class="create-btn full-width">
            <span>+</span> Nuova Iniziativa
          </button>
        </div>
      </aside>

      <main class="content-area">

        <div class="results-header">
          <h2>Esplora le Iniziative</h2>
          <span class="count-badge">{{ initiativeStore.totalObjects }} attive</span>
        </div>

        <div v-if="initiativeStore.loading" class="loading-container">
          <div class="spinner"></div>
          <p>Caricamento in corso...</p>
        </div>

        <div v-else-if="initiativeStore.initiatives.length > 0" class="cards-container">
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

          <div class="pagination-controls">
            <button @click="prevPage" :disabled="initiativeStore.currentPage === 1" class="page-btn arrow">←</button>
            <span class="page-info">{{ initiativeStore.currentPage }} / {{ initiativeStore.totalPages }}</span>
            <button @click="nextPage" :disabled="initiativeStore.currentPage >= initiativeStore.totalPages"
              class="page-btn arrow">→</button>
          </div>
        </div>

        <div v-else class="no-results">
          <p>Nessuna iniziativa trovata con questi filtri.</p>
          <button @click="resetFilters" class="clear-btn">Mostra tutte</button>
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

/* --- HERO & SEARCH --- */
.hero-section {
  margin-bottom: 30px;
  text-align: center;
}

.search-hero {
  display: flex;
  justify-content: center;
  gap: 10px;
  max-width: 600px;
  margin: 0 auto;
}

.search-hero input {
  flex: 1;
  padding: 14px 24px;
  border-radius: 50px;
  border: 1px solid var(--header-border);
  background-color: var(--input-bg);
  color: var(--text-color);
  outline: none;
  font-size: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.search-hero input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.search-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 0 28px;
  border-radius: 50px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 1rem;
}

.search-btn:hover {
  background: var(--accent-hover);
}

/* --- BUDGET SECTION --- */
.budget-section {
  margin-bottom: 40px;
}

/* --- MAIN GRID --- */
.main-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 40px;
  align-items: start;
}

/* --- SIDEBAR FILTRI --- */
.sidebar {
  background: var(--card-bg);
  padding: 25px;
  border-radius: 16px;
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  position: sticky;
  top: 20px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 15px;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.reset-link {
  background: none;
  border: none;
  color: var(--secondary-text);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: color 0.2s;
}

.reset-link:hover {
  color: var(--accent-color);
  text-decoration: underline;
}

.filter-group {
  margin-bottom: 20px;
}

.filter-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--secondary-text);
}

.filter-group select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--header-border);
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.95rem;
  cursor: pointer;
}

/* BOTTONE CREA NUOVA */
.create-btn.full-width {
  width: 100%;
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  margin-top: 15px;
  transition: transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.create-btn.full-width:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
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

.count-badge {
  background: var(--input-bg);
  border: 1px solid var(--header-border);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
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
  /* 1. Altezza minima ridotta per compattezza */
  min-height: 180px;
}

.card-image-wrapper {
  /* Larghezza ridotta */
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

/* 2. STATUS BADGE (più piccolo e compatto) */
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

/* 3. Titolo più grande */
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

/* 3. BOTTONE FOLLOW */
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

/* 1. Hover Giallo per Segui Aggiornamenti */
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

/* 4. Firme più grandi */
.signatures-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

/* 5. AZIONI (Stile unificato) */
.action-btn,
.external-btn {
  background: transparent;
  border: 1px solid var(--secondary-text);
  /* Neutro inizialmente */
  color: var(--text-color);
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

/* Hover verde solo quando ci passi sopra */
.action-btn:hover,
.external-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(0, 0, 0, 0.02);
}

/* PAGINAZIONE */
.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 40px;
  align-items: center;
}

.page-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--header-border);
  background: var(--card-bg);
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-weight: 600;
  color: var(--secondary-text);
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
  .main-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    margin-bottom: 30px;
  }

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
