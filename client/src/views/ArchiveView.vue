<script setup>
import { ref, computed, onMounted } from 'vue'
// IMPORTIAMO ENTRAMBI GLI STORE
import { useInitiativeStore } from '../stores/initiativeStore'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'

// Istanziamo entrambi
const initiativeStore = useInitiativeStore()
const budgetStore = useParticipatoryBudgetStore()

// --- STATO FILTRO ---
// 'initiatives' oppure 'budgets'
const activeTab = ref('initiatives')

onMounted(() => {
  // Carichiamo le iniziative dallo store giusto
  initiativeStore.fetchInitiatives(1, 'date') // Carichiamo per data (più logico per archivio)

  // Carichiamo i bilanci dallo store giusto
  budgetStore.fetchBudgetArchive()
})

// --- LOGICA INIZIATIVE ---
// Filtriamo quelle NON in corso (Approvate, Respinte, Scadute)
const archivedInitiatives = computed(() => {
  return initiativeStore.initiatives.filter(item => item.status !== 'In corso')
})

// Funzione helper date
const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}
</script>

<template>
  <div class="archive-wrapper">

    <div class="archive-header">
      <h1>Archivio Storico</h1>
      <p>Consulta le iniziative passate e i bilanci partecipativi conclusi.</p>
    </div>

    <div class="tabs-container">
      <button @click="activeTab = 'initiatives'" class="tab-btn" :class="{ active: activeTab === 'initiatives' }">
        📜 Iniziative Concluse
      </button>

      <button @click="activeTab = 'budgets'" class="tab-btn" :class="{ active: activeTab === 'budgets' }">
        💰 Bilanci Partecipativi
      </button>
    </div>

    <div v-if="activeTab === 'initiatives'" class="tab-content">

      <div v-if="initiativeStore.loading" class="empty-msg">Caricamento in corso...</div>

      <div v-else-if="archivedInitiatives.length > 0" class="initiatives-grid">
        <div v-for="item in archivedInitiatives" :key="item.id" class="archive-card">
          <div class="status-stripe" :class="item.status.toLowerCase()"></div>
          <div class="ac-content">
            <span class="ac-status" :class="item.status.toLowerCase()">{{ item.status }}</span>
            <h3>{{ item.title }}</h3>
            <div class="ac-meta">
              <span>📅 {{ formatDate(item.creationDate) }}</span>
              <span>🏷️ {{ initiativeStore.getCategoryName(item.categoryId) }}</span>
            </div>
            <RouterLink :to="{ name: 'initiative-detail', params: { id: item.id } }" class="ac-link">
              Rivedi Dettagli →
            </RouterLink>
          </div>
        </div>
      </div>

      <div v-else class="empty-msg">Nessuna iniziativa conclusa trovata.</div>
    </div>

    <div v-if="activeTab === 'budgets'" class="tab-content">

      <div v-if="budgetStore.loading" class="empty-msg">Caricamento in corso...</div>

      <div v-else-if="budgetStore.budgetArchive.length > 0" class="budgets-list">
        <div v-for="budget in budgetStore.budgetArchive" :key="budget.id" class="budget-row">
          <div class="br-left">
            <h3>{{ budget.title }}</h3>
            <p class="br-date">Concluso il: {{ formatDate(budget.expirationDate) }}</p>
          </div>

          <div class="br-right">
            <span class="project-count">{{ budget.options?.length || 0 }} Progetti Candidati</span>
            <button class="history-btn" title="Vedi i dettagli">
              {{ budget.options ? 'Vedi Opzioni' : 'Dettagli' }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-msg">Nessun bilancio storico trovato.</div>
    </div>

  </div>
</template>

<style scoped>
/* STESSO CSS DI PRIMA (È PERFETTO) */
.archive-wrapper {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.archive-header {
  text-align: center;
  margin-bottom: 40px;
}

.archive-header h1 {
  font-size: 2.5rem;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.archive-header p {
  color: var(--secondary-text);
}

/* --- TABS --- */
.tabs-container {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 40px;
}

.tab-btn {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-color);
  padding: 12px 30px;
  border-radius: 30px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: var(--accent-color);
}

.tab-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

/* --- CARDS INIZIATIVE (Compatte) --- */
.initiatives-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.archive-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
}

.status-stripe {
  width: 6px;
  height: 100%;
}

.status-stripe.approvata {
  background-color: #4caf50;
}

.status-stripe.respinta {
  background-color: #f44336;
}

.status-stripe.scaduta {
  background-color: #9e9e9e;
}

.ac-content {
  padding: 15px;
  flex: 1;
}

.ac-status {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 8px;
}

.ac-status.approvata {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.ac-status.respinta {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.ac-status.scaduta {
  background: rgba(158, 158, 158, 0.1);
  color: #9e9e9e;
}

.ac-content h3 {
  margin: 0 0 10px 0;
  font-size: 1.1rem;
}

.ac-meta {
  font-size: 0.85rem;
  color: var(--secondary-text);
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.ac-link {
  font-size: 0.9rem;
  text-decoration: none;
  color: var(--accent-color);
  font-weight: bold;
}

.ac-link:hover {
  text-decoration: underline;
}

/* --- LISTA BILANCI --- */
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
  transition: transform 0.2s;
}

.budget-row:hover {
  transform: translateX(5px);
  border-color: var(--accent-color);
}

.br-left h3 {
  margin: 0 0 5px 0;
  font-size: 1.2rem;
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

.project-count {
  font-weight: bold;
  color: var(--text-color);
}

.history-btn {
  background: var(--input-bg);
  border: 1px solid var(--header-border);
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--secondary-text);
  cursor: pointer;
  /* Riabilitato il cursore */
}

.history-btn:hover {
  background: var(--card-border);
}

/* Responsive */
@media (max-width: 600px) {
  .tabs-container {
    flex-direction: column;
  }

  .budget-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .br-right {
    width: 100%;
    justify-content: space-between;
  }
}

.empty-msg {
  text-align: center;
  color: var(--secondary-text);
  padding: 40px;
  font-style: italic;
}
</style>
