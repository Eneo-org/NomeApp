<script setup>
import { onMounted } from 'vue'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'
import { useUserStore } from '../stores/userStore'
import ParticipatoryBudgetCard from '@/components/ParticipatoryBudgetCard.vue'
import InitiativeCard from '@/components/InitiativeCard.vue'
import { useRouter } from 'vue-router';
import { useToastStore } from '../stores/toastStore';
import { formatCooldownTime } from '@/utils/dateUtils';

const initiativeStore = useInitiativeStore()
const budgetStore = useParticipatoryBudgetStore()
const userStore = useUserStore()
const router = useRouter();
const toast = useToastStore();

// --- INIT ---
onMounted(async () => {
  initiativeStore.fetchFiltersData()
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
</script>

<template>
  <div class="home-wrapper">

    <div class="budget-section">
      <div class="budget-card-container">
        <ParticipatoryBudgetCard />
      </div>
      <div class="create-initiative-box">
        <div class="box-content">
          <h3>Hai un'idea per la nostra città?</h3>
          <p>
            Proponi un'iniziativa per migliorare la comunità. La tua idea potrebbe essere la prossima a
            essere realizzata!
          </p>
          <button @click="handleCreateClick" class="btn-create">
            ✨ Crea la tua Iniziativa
          </button>
        </div>
      </div>
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
          <InitiativeCard 
            v-for="item in initiativeStore.initiatives" 
            :key="item.id" 
            :item="item" 
          />
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
  display: flex;
  gap: 20px;
  margin-bottom: 40px;
  align-items: center; /* Assicura che i figli abbiano la stessa altezza */
}

.budget-card-container {
  flex: 2; /* Più spazio per il budget */
}

.create-initiative-box {
  flex: 1; /* Meno spazio per la call to action */
  display: flex; /* Centra il contenuto verticalmente */
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 25px;
  text-align: center;
  box-shadow: var(--card-shadow);
  transition: all 0.3s ease;
}

.create-initiative-box:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: var(--accent-color);
}

.box-content {
  margin: auto;
}

.create-initiative-box h3 {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 15px;
  color: var(--accent-color);
}

.create-initiative-box p {
  color: var(--secondary-text);
  line-height: 1.6;
  margin-bottom: 25px;
}

.btn-create {
  background: linear-gradient(45deg, var(--accent-color), #58b28a);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 25px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.btn-create:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

@media (max-width: 992px) {
  .budget-section {
    flex-direction: column;
  }
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
</style>
