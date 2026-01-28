<script setup>
import { onMounted } from 'vue'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'

const budgetStore = useParticipatoryBudgetStore()

onMounted(() => {
  budgetStore.fetchBudgetArchive()
})

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}
</script>

<template>
  <div class="archive-wrapper">
    <div class="header">
      <h1>🗃️ Archivio Bilanci Partecipativi</h1>
      <p>Visualizza i risultati dei bilanci partecipativi conclusi.</p>
    </div>

    <div class="tab-content">
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
.archive-wrapper {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  color: var(--accent-color);
}

.header p {
  color: var(--secondary-text);
  font-size: 1.1rem;
}

.loading-msg,
.error-msg,
.empty-msg {
  text-align: center;
  padding: 40px;
  font-size: 1.2rem;
}

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
  box-shadow: var(--card-shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}

.budget-row:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

.br-left h3 {
  margin: 0 0 5px 0;
  color: var(--text-color);
  font-size: 1.3rem;
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
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color);
  border: 1px solid var(--card-border);
}

.history-btn {
  background: var(--accent-color);
  color: white;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.history-btn:hover {
  background: #c0392b; /* Un colore leggermente più scuro per l'hover */
}
</style>
