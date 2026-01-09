<script setup>
import { computed } from 'vue';
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore';
import { useToastStore } from '../stores/toastStore';
import { useUserStore } from '../stores/userStore';

const store = useParticipatoryBudgetStore();
const toast = useToastStore();
const userStore = useUserStore();

// 1. CALCOLO TOTALE VOTI (CON PROTEZIONE ERRORI)
const totalVotes = computed(() => {
  const budget = store.activeBudget;
  // Se i dati non sono ancora arrivati o mancano le opzioni, ritorna 0
  if (!budget || !budget.options || !Array.isArray(budget.options)) return 0;

  return budget.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);
});

// 2. FUNZIONE PER CALCOLARE LA PERCENTUALE
const getPercentage = (votes) => {
  if (totalVotes.value === 0) return 0;
  return Math.round((votes / totalVotes.value) * 100);
};

// 3. GESTIONE VOTO CON TOAST
const handleVote = async (position) => {
  try {
    await store.voteBudgetOption(position);
    toast.showToast("✅ Voto registrato con successo!", "success");
  } catch (error) {
    toast.showToast(error.message, "error");
  }
};
</script>

<template>
  <div v-if="store.activeBudget" class="budget-card">

    <div class="card-header">
      <div class="header-top">
        <span class="live-badge">🔴 VOTAZIONE APERTA</span>
        <span class="expiry-date">Scade il: {{ new Date(store.activeBudget.expirationDate).toLocaleDateString('it-IT')
          }}</span>
      </div>
      <h2>{{ store.activeBudget.title }}</h2>
      <p class="subtitle">Scegli uno dei 5 progetti finalisti. Il più votato verrà finanziato!</p>
    </div>

    <div class="options-container">
      <div v-for="option in store.activeBudget.options" :key="option.id" class="option-row"
        :class="{ 'is-selected': store.activeBudget.votedOptionId === option.position }">

        <div class="opt-info">
          <div class="opt-number">#{{ option.position }}</div>
          <div class="opt-text">{{ option.text }}</div>
        </div>

        <div class="opt-stats">
          <div class="stats-text">
            <strong>{{ option.votes }}</strong> voti ({{ getPercentage(option.votes) }}%)
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: getPercentage(option.votes) + '%' }"></div>
          </div>
        </div>

        <div class="opt-action">
          <button v-if="store.activeBudget.votedOptionId === option.position" class="vote-btn voted" disabled>
            VOTATO ✅
          </button>

          <button v-else class="vote-btn" :disabled="!!store.activeBudget.votedOptionId || !userStore.canVote"
            :title="!userStore.canVote ? 'Solo i cittadini possono votare' : ''" @click="handleVote(option.position)">
            {{ !userStore.canVote ? '⛔ NO VOTO' : 'VOTA' }}
          </button>
        </div>

      </div>
    </div>

    <div class="card-footer">
      Totale voti raccolti: <strong>{{ totalVotes }}</strong>
    </div>
  </div>

  <div v-else-if="store.loading" class="loading-state">
    <div class="spinner"></div>
    <p>Caricamento Bilancio Partecipativo...</p>
  </div>
</template>

<style scoped>
/* --- STILI GENERALI CARD (Dark Mode compatibile) --- */
.budget-card {
  background-color: var(--card-bg);
  /* Usa variabile tema per cambiare colre */
  border: 1px solid var(--accent-color);
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 40px;
  box-shadow: var(--card-shadow);
  color: var(--text-color);
  transition: background-color 0.3s, color 0.3s;
}

/* --- HEADER --- */
.card-header {
  text-align: center;
  margin-bottom: 25px;
}

.header-top {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
}

.live-badge {
  background-color: #e74c3c;
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
  animation: pulse 2s infinite;
}

.expiry-date {
  font-size: 0.9rem;
  color: var(--secondary-text);
}

.card-header h2 {
  margin: 5px 0;
  color: var(--accent-color);
  font-size: 1.8rem;
}

.subtitle {
  color: var(--secondary-text);
  font-size: 0.95rem;
  margin-top: 5px;
}

/* --- RIGHE OPZIONI (Le 5 righe) --- */
.options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--input-bg);
  /* Sfondo diverso per dark/light */
  border: 1px solid var(--header-border);
  padding: 12px 15px;
  border-radius: 10px;
  gap: 15px;
  transition: transform 0.2s, border-color 0.2s;
}

.option-row:hover {
  transform: translateX(4px);
  border-color: var(--accent-color);
}

/* Stile per la riga votata */
.option-row.is-selected {
  border: 2px solid var(--accent-color);
  background-color: rgba(66, 184, 131, 0.1);
}

/* Parte Sinistra: Numero e Testo */
.opt-info {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 12px;
}

.opt-number {
  background-color: var(--card-border);
  color: var(--text-color);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.opt-text {
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.2;
}

/* Parte Centrale: Statistiche e Barra */
.opt-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 120px;
}

.stats-text {
  font-size: 0.8rem;
  color: var(--secondary-text);
  margin-bottom: 4px;
  text-align: right;
}

.progress-track {
  width: 100%;
  height: 8px;
  background-color: var(--header-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--accent-color);
  border-radius: 4px;
  transition: width 0.5s ease-out;
}

/* Parte Destra: Bottone */
.opt-action {
  flex-shrink: 0;
}

.vote-btn {
  background-color: var(--text-color);
  /* Inversione colori per contrasto */
  color: var(--bg-color);
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 90px;
}

.vote-btn:hover:not(:disabled) {
  background-color: var(--accent-color);
  color: white;
  transform: scale(1.05);
}

.vote-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.vote-btn.voted {
  background-color: var(--accent-color);
  color: white;
  opacity: 1;
  cursor: default;
}

/* --- FOOTER --- */
.card-footer {
  margin-top: 20px;
  text-align: center;
  font-size: 0.9rem;
  color: var(--secondary-text);
  border-top: 1px dashed var(--header-border);
  padding-top: 15px;
}

/* --- LOADING --- */
.loading-state {
  text-align: center;
  padding: 40px;
  color: var(--secondary-text);
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: var(--accent-color);
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }

  100% {
    opacity: 1;
  }
}

/* Responsive per cellulari */
@media (max-width: 600px) {
  .option-row {
    flex-wrap: wrap;
  }

  .opt-stats {
    order: 3;
    width: 100%;
    margin-top: 8px;
  }

  .opt-action {
    margin-left: auto;
  }
}
</style>
