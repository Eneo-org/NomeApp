<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useInitiativeStore } from '../stores/initiativeStore'
import InitiativeCard from '@/components/InitiativeCard.vue'

const route = useRoute()
const initiativeStore = useInitiativeStore()

// --- STATO FILTRI ARCHIVIO ---
const filters = ref({
  search: '', // NUOVO: Campo ricerca
  status: [],
  sortBy: 1, // 1 = Data Creazione, 2 = Numero Firme
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
    : undefined;

  await initiativeStore.fetchInitiatives(
    initiativeStore.currentPage,
    filters.value.sortBy,
    {
      ...filters.value,
      status: statusToSend
    },
    'archive' // IMPORTANTE: contesto archive
  );
};

onMounted(() => {
  console.log('📚 InitiativesView montata - caricamento archivio');
  // fetchFiltersData viene chiamato in App.vue una sola volta
  // Reset pagina corrente
  initiativeStore.currentPage = 1;
  
  if (route.query.search) {
    filters.value.search = route.query.search;
  } else if (route.query.status) {
    if (Array.isArray(route.query.status)) {
      filters.value.status = route.query.status;
    } else {
      filters.value.status = [route.query.status];
    }
  }
  // fetchFiltersData viene chiamato in App.vue - non serve qui
  loadArchiveData();
})

// --- WATCHERS PER I FILTRI ---
watch(() => route.query.search, (newSearch) => {
  filters.value.search = newSearch || '';
});

// Debounce timeout per evitare troppe richieste
let filterDebounceTimeout = null;
let isFirstMount = true; // Flag per ignorare il primo trigger del watcher

// Watcher sui filtri - ricarica quando cambiano (con debounce di 800ms)
watch(filters, () => {
  // Ignora il primo trigger (succede al mount)
  if (isFirstMount) {
    isFirstMount = false;
    return;
  }
  
  console.log('📝 Filtri cambiati, attendo debounce...');
  
  if (filterDebounceTimeout) {
    clearTimeout(filterDebounceTimeout);
  }
  
  filterDebounceTimeout = setTimeout(() => {
    console.log('✅ Debounce completato, ricarico archivio');
    initiativeStore.currentPage = 1;
    loadArchiveData();
  }, 800);
}, { deep: true });

const changePage = async (newPage) => {
  if (newPage < 1 || newPage > initiativeStore.totalPages) return;
  initiativeStore.currentPage = newPage;
  await loadArchiveData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>

<template>
  <div class="archive-wrapper">
    <div class="archive-layout">
      
      <aside class="filters-sidebar">
        <h3>🔍 Filtra Iniziative</h3>

        <div class="filter-group">
          <label>Esito / Stato</label>
          <div class="checkbox-group">
            <label><input type="checkbox" value="In corso" v-model="filters.status"> ⏳ In corso</label>
            <label><input type="checkbox" value="Approvata" v-model="filters.status"> ✅ Approvata</label>
            <label><input type="checkbox" value="Respinta" v-model="filters.status"> ❌ Respinta</label>
            <label><input type="checkbox" value="Scaduta" v-model="filters.status"> ⏰ Scaduta</label>
          </div>
        </div>

        <div class="filter-group">
          <label>Ordina per</label>
          <select v-model="filters.sortBy">
            <option :value="1">Data Creazione</option>
            <option :value="2">Numero Firme</option>
          </select>
          <div class="radio-row">
            <template v-if="filters.sortBy === 1">
              <label><input type="radio" value="desc" v-model="filters.order"> Più recenti</label>
              <label><input type="radio" value="asc" v-model="filters.order"> Meno recenti</label>
            </template>
            <template v-else>
              <label><input type="radio" value="desc" v-model="filters.order"> Maggiori</label>
              <label><input type="radio" value="asc" v-model="filters.order"> Minori</label>
            </template>
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
          @click="filters = { search: '', status: [], sortBy: 1, order: 'desc', platform: '', category: '', dateFrom: '', dateTo: '' }">
          Azzera Filtri
        </button>
      </aside>

      <main class="results-area">

        <div v-if="initiativeStore.archiveLoading" class="loading-msg">Caricamento archivio...</div>

        <div v-else-if="initiativeStore.archiveInitiatives.length > 0">

          <div class="initiatives-list">
            <InitiativeCard 
              v-for="item in initiativeStore.archiveInitiatives" 
              :key="item.id" 
              :item="item" 
            />
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
}
</style>