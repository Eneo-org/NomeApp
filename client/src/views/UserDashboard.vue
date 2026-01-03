<script setup>
import { ref, onMounted, watch } from 'vue'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useUserStore } from '../stores/userStore'
import { useRouter } from 'vue-router'

const initiativeStore = useInitiativeStore()
const userStore = useUserStore()
const router = useRouter()

// Stato della pagina
const activeTab = ref('created') // Tab attiva di default
const myInitiatives = ref([]) // Lista iniziative da mostrare

// Funzione per caricare i dati in base alla tab selezionata
const loadData = async () => {
  if (!userStore.isAuthenticated) {
    router.push('/')
    return
  }
  myInitiatives.value = await initiativeStore.fetchUserInitiatives(activeTab.value)
}

// Carica i dati all'avvio e al cambio tab
onMounted(() => { loadData() })
watch(activeTab, () => { loadData() })
</script>

<template>
  <div class="dashboard-container">

    <div class="dashboard-header">
      <h1>Ciao, {{ userStore.user?.name || 'Cittadino' }}!</h1>
      <p>Benvenuto nella tua area personale.</p>
    </div>

    <div class="tabs">
      <button :class="{ active: activeTab === 'created' }" @click="activeTab = 'created'">
        Le mie Proposte
      </button>
      <button :class="{ active: activeTab === 'signed' }" @click="activeTab = 'signed'">
        Firmate
      </button>
      <button :class="{ active: activeTab === 'followed' }" @click="activeTab = 'followed'">
        Seguite
      </button>
    </div>

    <div class="results-area">
      <div v-if="initiativeStore.loading" class="loading-msg">Caricamento in corso...</div>

      <div v-else-if="myInitiatives.length === 0" class="no-results">
        <p>Nessuna iniziativa trovata in questa sezione.</p>
      </div>

      <div v-else class="cards-container">
        <div v-for="item in myInitiatives" :key="item.id" class="card">

          <div class="card-header">
            <h3>{{ item.title || 'Iniziativa senza titolo' }}</h3>

            <span class="status-badge" :class="item.status ? item.status.toLowerCase().replace(' ', '-') : 'unknown'">
              {{ item.status || 'Sconosciuto' }}
            </span>
          </div>

          <div class="card-meta">
            <p>
              <strong>Autore:</strong>
              {{ item.authorName || ('Utente #' + (item.authorId || '?')) }}
            </p>
            <p>
              <strong>Categoria:</strong>
              {{ initiativeStore.getCategoryName(item.categoryId) }}
            </p>
          </div>

          <p class="description">
            {{ item.description ? item.description.substring(0, 100) + '...' : 'Nessuna descrizione disponibile.' }}
          </p>

          <div class="card-footer">
            <span class="signatures">
              Firme raccolte: <strong>{{ item.signatures || 0 }}</strong>
            </span>

            <RouterLink :to="{ name: 'initiative-detail', params: { id: item.id } }">
              <button class="detail-btn">Vedi Dettagli</button>
            </RouterLink>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout Generale Dashboard */
.dashboard-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', sans-serif;
  color: var(--text-color);
}

.dashboard-header {
  margin-bottom: 30px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 15px;
}

.dashboard-header h1 {
  margin: 0;
  color: var(--text-color);
}

.dashboard-header p {
  color: var(--secondary-text);
  margin-top: 5px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  border-bottom: 2px solid var(--header-border);
}

.tabs button {
  background: none;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 1rem;
  color: var(--secondary-text);
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tabs button:hover {
  color: var(--text-color);
}

.tabs button.active {
  border-bottom: 3px solid var(--accent-color);
  color: var(--accent-color);
  font-weight: bold;
}

/* Stili Cards (Identici alla Home) */
.cards-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 20px;
  border-radius: 12px;
  color: var(--text-color);
  box-shadow: var(--card-shadow);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.card-header h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 1.3rem;
}

.card-meta {
  font-size: 0.9rem;
  color: var(--secondary-text);
  margin-bottom: 10px;
  display: flex;
  gap: 20px;
}

.card-meta strong {
  color: var(--accent-color);
}

.description {
  color: var(--secondary-text);
  margin-bottom: 15px;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--card-border);
  padding-top: 15px;
}

.signatures {
  font-size: 0.95rem;
}

.detail-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.detail-btn:hover {
  opacity: 0.9;
}

/* Badges */
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}

.in-corso {
  background: #1565c0;
  color: white;
}

.approvata {
  background: #2e7d32;
  color: white;
}

.scaduta {
  background: #424242;
  color: #aaa;
  border: 1px solid #666;
}

.respinta {
  background: #c62828;
  color: white;
}

.unknown {
  background: #333;
  color: #888;
}

.loading-msg,
.no-results {
  text-align: center;
  color: var(--secondary-text);
  margin-top: 30px;
}
</style>
