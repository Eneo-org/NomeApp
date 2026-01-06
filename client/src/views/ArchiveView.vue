<script setup>
import { ref, onMounted, watch } from 'vue'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'
import { useUserStore } from '../stores/userStore'
import defaultImage from '@/assets/placeholder-initiative.jpg';

const initiativeStore = useInitiativeStore()
const budgetStore = useParticipatoryBudgetStore()
const userStore = useUserStore()
const activeTab = ref('initiatives')
const API_URL = 'http://localhost:3000';

// --- STATO FILTRI ARCHIVIO ---
const filters = ref({
  search: '', // NUOVO: Campo ricerca
  status: [],
  sortBy: 'date',
  order: 'desc',
  platform: '',
  category: '',
  dateFrom: '',
  dateTo: ''
});

// --- LOAD DATA ---
const loadArchiveData = async () => {
  const statusToSend = filters.value.status.length > 0
    ? filters.value.status
    : ['Approvata', 'Respinta', 'Scaduta'];

  await initiativeStore.fetchInitiatives(
    initiativeStore.currentPage,
    filters.value.sortBy,
    {
      ...filters.value,
      status: statusToSend,
      order: filters.value.order
    }
  );
};

onMounted(() => {
  initiativeStore.fetchFiltersData();
  loadArchiveData();

  if (userStore.isAuthenticated && userStore.user?.isAdmin) {
    budgetStore.fetchBudgetArchive()
  }
})

// --- WATCHERS PER I FILTRI ---
watch(filters, () => {
  initiativeStore.currentPage = 1;
  loadArchiveData();
}, { deep: true });

const changePage = async (newPage) => {
  if (newPage < 1 || newPage > initiativeStore.totalPages) return;
  initiativeStore.currentPage = newPage;
  await loadArchiveData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- HELPERS ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}

const getImageUrl = (item) => {
  if (!item.attachment || !item.attachment.filePath) {
    return defaultImage;
  }
  const cleanPath = item.attachment.filePath.replace(/\\/g, '/');
  return `${API_URL}/${cleanPath}`;
};

const getStatusClass = (status) => {
  if (!status) return 'status-default';
  const s = status.toLowerCase();
  if (s === 'approvata') return 'status-success';
  if (s === 'respinta') return 'status-danger';
  if (s === 'scaduta') return 'status-muted';
  return 'status-default';
};
</script>

<template>
  <div class="archive-wrapper">

    <div class="archive-header">
      <h1>🗄️ Archivio Storico</h1>
      <p>Esplora le iniziative passate e i risultati ottenuti.</p>
    </div>

    <div v-if="userStore.isAuthenticated && userStore.user?.isAdmin" class="tabs-container">
      <button @click="activeTab = 'initiatives'" class="tab-btn" :class="{ active: activeTab === 'initiatives' }">
        📜 Iniziative Concluse
      </button>

      <button @click="activeTab = 'budgets'" class="tab-btn" :class="{ active: activeTab === 'budgets' }">
        💰 Bilanci Partecipativi
      </button>
    </div>

    <div v-if="activeTab === 'initiatives'" class="archive-layout">

      <aside class="filters-sidebar">
        <h3>🔍 Filtra Archivio</h3>

        <div class="filter-group">
          <label>Cerca</label>
          <input type="text" v-model.lazy="filters.search" placeholder="Parole chiave...">
        </div>

        <div class="filter-group">
          <label>Esito / Stato</label>
          <div class="checkbox-group">
            <label><input type="checkbox" value="Approvata" v-model="filters.status"> ✅ Approvata</label>
            <label><input type="checkbox" value="Respinta" v-model="filters.status"> ❌ Respinta</label>
            <label><input type="checkbox" value="Scaduta" v-model="filters.status"> ⏰ Scaduta</label>
          </div>
        </div>

        <div class="filter-group">
          <label>Ordina per</label>
          <select v-model="filters.sortBy">
            <option value="date">Data Creazione</option>
            <option value="signatures">Numero Firme</option>
          </select>
          <div class="radio-row">
            <label><input type="radio" value="desc" v-model="filters.order"> Più recenti</label>
            <label><input type="radio" value="asc" v-model="filters.order"> Meno recenti</label>
          </div>
        </div>

        <div class="filter-group">
          <label>Piattaforma</label>
          <select v-model="filters.platform">
            <option value="">Tutte</option>
            <option v-for="p in initiativeStore.platforms" :key="p.id" :value="p.id">
              {{ p.platformName }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Categoria</label>
          <select v-model="filters.category">
            <option value="">Tutte</option>
            <option v-for="cat in initiativeStore.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Periodo (Data Creazione)</label>
          <div class="date-inputs">
            <input type="date" v-model="filters.dateFrom" placeholder="Dal">
            <input type="date" v-model="filters.dateTo" placeholder="Al">
          </div>
        </div>

        <button class="reset-btn"
          @click="filters = { search: '', status: [], sortBy: 'date', order: 'desc', platform: '', category: '', dateFrom: '', dateTo: '' }">
          Azzera Filtri
        </button>
      </aside>

      <main class="results-area">

        <div v-if="initiativeStore.loading" class="loading-msg">Caricamento archivio...</div>

        <div v-else-if="initiativeStore.initiatives.length > 0">

          <div class="initiatives-list">

            <div v-for="item in initiativeStore.initiatives" :key="item.id" class="card">
              <div class="card-image-wrapper">
                <div v-if="item.platformId !== 1" class="source-badge external">
                  🔗 {{ initiativeStore.getPlatformName(item.platformId) }}
                </div>
                <img :src="getImageUrl(item)" class="card-img" alt="Immagine iniziativa">
              </div>

              <div class="card-content">
                <div class="card-header">
                  <h3>{{ item.title }}</h3>
                  <div class="status-wrapper">
                    <span class="badge-status" :class="getStatusClass(item.status)">
                      {{ item.status.toUpperCase() }}
                    </span>
                  </div>
                </div>

                <div class="card-meta">
                  <span>📍 <strong>{{ item.place || 'Trento' }}</strong></span>
                  <span>🏷️ {{ initiativeStore.getCategoryName(item.categoryId) }}</span>
                  <div class="date-row"><span>📅 Scaduta il: {{ formatDate(item.expirationDate) }}</span></div>
                </div>

                <div class="card-footer">
                  <div class="signatures">
                    <strong>Firme: {{ item.signatures }}</strong>
                  </div>
                  <div class="actions">
                    <RouterLink :to="'/initiative/' + item.id">
                      <button class="action-btn">Rivedi Dettagli</button>
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="pagination-controls">
            <button @click="changePage(initiativeStore.currentPage - 1)" :disabled="initiativeStore.currentPage === 1"
              class="page-btn">←</button>
            <span class="page-info">Pagina {{ initiativeStore.currentPage }} di {{ initiativeStore.totalPages }}</span>
            <button @click="changePage(initiativeStore.currentPage + 1)"
              :disabled="initiativeStore.currentPage === initiativeStore.totalPages" class="page-btn">→</button>
          </div>
        </div>

        <div v-else class="empty-msg">Nessuna iniziativa trovata con questi filtri.</div>
      </main>

    </div>

    <div v-if="activeTab === 'budgets'" class="tab-content">
      <div v-if="budgetStore.loading" class="loading-msg">Caricamento archivio...</div>
      <div v-else-if="budgetStore.error" class="error-msg">⚠️ {{ budgetStore.error }}</div>
      <div v-else-if="budgetStore.budgetArchive.length > 0" class="budgets-list">
        <div v-for="budget in budgetStore.budgetArchive" :key="budget.id" class="budget-row">
          <div class="br-left">
            <h3>{{ budget.title }}</h3>
            <p class="br-date">📅 Scaduto il: {{ formatDate(budget.expirationDate) }}</p>
          </div>
          <div class="br-right">
            <div class="stats-pill"><strong>{{ budget.options?.length || 0 }}</strong> Progetti</div>
            <RouterLink :to="'/participatory-budget/' + budget.id" class="history-btn">📊 Risultati</RouterLink>
          </div>
        </div>
      </div>
      <div v-else class="empty-msg">
        <p>Nessun bilancio storico trovato.</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- STILI GENERALI --- */
.archive-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  color: var(--text-color);
}

.archive-header {
  text-align: center;
  margin-bottom: 30px;
}

.archive-header h1 {
  font-size: 2.5rem;
  color: var(--accent-color);
  margin-bottom: 5px;
}

/* --- TABS --- */
.tabs-container {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;
}

.tab-btn {
  background: transparent;
  border: 2px solid var(--card-border);
  padding: 10px 25px;
  border-radius: 25px;
  cursor: pointer;
  color: var(--secondary-text);
  font-weight: bold;
}

.tab-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

/* --- LAYOUT GRIGLIA PRINCIPALE --- */
.archive-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  /* Sidebar larga */
  gap: 30px;
  align-items: start;
}

/* --- SIDEBAR FILTRI --- */
.filters-sidebar {
  background: var(--card-bg);
  padding: 25px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);

  position: sticky;
  top: 90px;
  align-self: start;
  max-height: calc(100vh - 100px);

  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--card-bg);
}

.filters-sidebar h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--accent-color);
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 10px;
}

.filter-group {
  margin-bottom: 20px;
}

.filter-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 0.9rem;
  color: var(--text-color);
}

.filter-group input,
.filter-group select {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background-color: var(--input-bg);
  color: var(--text-color);
  box-sizing: border-box;
}

/* Checkbox (Revert a dimensione normale) */
.checkbox-group input[type="checkbox"] {
  margin: 0;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1.2;
}

/* Radio Buttons */
.radio-row {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  font-size: 0.9rem;
}

.radio-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.radio-row input[type="radio"] {
  margin: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.date-inputs {
  display: flex;
  gap: 10px;
}

.reset-btn {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--secondary-text);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-color);
  transition: 0.2s;
  margin-top: 10px;
}

.reset-btn:hover {
  background: var(--header-border);
}

/* --- LISTA INIZIATIVE (1 COLONNA - CARD LARGHE) --- */
.initiatives-list {
  display: grid;
  grid-template-columns: 1fr;
  /* Una sola colonna = card larghe */
  gap: 20px;
}

/* --- STILI CARD --- */
.card {
  display: flex;
  gap: 20px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  height: 180px;
  position: relative;
  box-shadow: var(--card-shadow);
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-image-wrapper {
  flex: 0 0 220px;
  background: #333;
  position: relative;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-content {
  flex: 1;
  padding: 15px 20px 15px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-header h3 {
  margin: 0;
  font-size: 1.4rem;
  /* Titolo leggermente più grande visto lo spazio */
  line-height: 1.2;
  color: var(--text-color);
  padding-right: 90px;
}

/* Badge Stato (Scaduta, ecc) in alto a destra */
.badge-status {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 5;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
}

.status-success {
  background-color: #27ae60;
}

.status-danger {
  background-color: #c0392b;
}

.status-muted {
  background-color: #7f8c8d;
}

.status-default {
  background-color: #7f8c8d;
}

/* Badge Piattaforma in alto a sinistra */
.source-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  background-color: #d32f2f;
  color: white;
}

.card-meta {
  font-size: 0.9rem;
  color: var(--secondary-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 5px;
}

.date-row {
  margin-top: 5px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.action-btn {
  background-color: var(--card-bg);
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: bold;
  font-size: 0.9rem;
}

.action-btn:hover {
  background-color: var(--accent-color);
  color: white;
}

/* --- PAGINAZIONE --- */
.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
  align-items: center;
}

.page-btn {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-color);
  width: 40px;
  height: 40px;
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

/* --- BILANCI LIST --- */
.budgets-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.budget-row {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 20px;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.br-left h3 {
  margin: 0 0 5px 0;
  color: var(--text-color);
}

.br-date {
  margin: 0;
  font-size: 0.9rem;
  color: var(--secondary-text);
}

.br-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stats-pill {
  background: var(--input-bg);
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  color: var(--text-color);
}

.history-btn {
  background: var(--accent-color);
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: bold;
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .archive-layout {
    grid-template-columns: 1fr;
  }

  .filters-sidebar {
    position: static;
    max-height: none;
    margin-bottom: 30px;
  }

  .initiatives-list {
    grid-template-columns: 1fr;
  }

  .card {
    flex-direction: column;
    height: auto;
  }

  .card-image-wrapper {
    flex: none;
    height: 160px;
    width: 100%;
  }
}
</style>
