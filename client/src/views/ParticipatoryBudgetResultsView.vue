<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore';

const route = useRoute();
const budgetStore = useParticipatoryBudgetStore();

// Trova il bilancio corrente dallo store usando l'ID nella URL
// Nota: Funziona se arrivi dall'archivio. Se ricarichi la pagina, budgetStore potrebbe svuotarsi
// (per un'app completa servirebbe una fetch specifica per ID, ma per ora va bene così).
const budget = computed(() => {
  return budgetStore.budgetArchive.find(b => b.id == route.params.id);
});

// Calcola il totale dei voti per le percentuali
const totalVotes = computed(() => {
  return budget.value?.options.reduce((acc, opt) => acc + opt.votes, 0) || 0;
});

const getPercentage = (votes) => {
  if (!totalVotes.value) return 0;
  return ((votes / totalVotes.value) * 100).toFixed(1);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  return new Date(dateString).toLocaleDateString('it-IT');
};
</script>

<template>
  <div class="results-wrapper">
    <div v-if="budget" class="results-card">
      <div class="header">
        <h1>📊 Risultati: {{ budget.title }}</h1>
        <p class="subtitle">Scaduto il: {{ formatDate(budget.expirationDate) }}</p>
      </div>

      <div class="options-list">
        <div v-for="option in budget.options" :key="option.id" class="option-item">
          <div class="option-info">
            <span class="opt-text">{{ option.text }}</span>
            <span class="opt-votes"><strong>{{ option.votes }}</strong> voti ({{ getPercentage(option.votes) }}%)</span>
          </div>
          <div class="progress-bg">
            <div class="progress-fill" :style="{ width: getPercentage(option.votes) + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Totale Voti: <strong>{{ totalVotes }}</strong></p>
        <button @click="$router.back()" class="back-btn">Torna all'Archivio</button>
      </div>
    </div>

    <div v-else class="not-found">
      <h2>Bilancio non trovato</h2>
      <p>Torna all'archivio per ricaricare i dati.</p>
      <button @click="$router.push('/archive')" class="back-btn">Vai all'Archivio</button>
    </div>
  </div>
</template>

<style scoped>
.results-wrapper {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
  color: var(--text-color);
}

.results-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--card-shadow);
}

.header h1 {
  color: var(--accent-color);
  margin-bottom: 5px;
}

.subtitle {
  color: var(--secondary-text);
  margin-bottom: 30px;
}

.option-item {
  margin-bottom: 20px;
}

.option-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 1rem;
}

.progress-bg {
  width: 100%;
  height: 12px;
  background-color: var(--input-bg);
  /* Sfondo scuro barra */
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--accent-color);
  transition: width 0.5s ease;
}

.footer {
  margin-top: 40px;
  border-top: 1px solid var(--header-border);
  padding-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-btn {
  background: transparent;
  border: 1px solid var(--accent-color);
  color: var(--accent-color);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.back-btn:hover {
  background: var(--accent-color);
  color: white;
}
</style>
