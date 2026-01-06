<script setup>
import { ref } from 'vue';
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore';
import { useRouter } from 'vue-router';

const store = useParticipatoryBudgetStore();
const router = useRouter();

// Stato del form
const form = ref({
  title: '',
  expirationDate: '',
  // 5 Opzioni vuote pre-generate (Posizione fissa 1-5)
  options: [
    { text: '', position: 1 },
    { text: '', position: 2 },
    { text: '', position: 3 },
    { text: '', position: 4 },
    { text: '', position: 5 }
  ]
});

const handleSubmit = async () => {
  // Validazione locale base
  if (!form.value.title || !form.value.expirationDate) {
    alert("Inserisci titolo e data di scadenza.");
    return;
  }

  // Verifica che tutte le 5 opzioni siano compilate
  const emptyOptions = form.value.options.some(opt => !opt.text.trim());
  if (emptyOptions) {
    alert("Devi compilare tutte e 5 le opzioni obbligatorie.");
    return;
  }

  // Invio allo store
  const success = await store.createParticipatoryBudget(form.value);

  if (success) {
    alert("Bilancio creato con successo! 🎉");
    router.push('/'); // Torna alla home per vederlo subito
  }
};
</script>

<template>
  <div class="admin-container">
    <div class="admin-card">
      <div class="header">
        <h1>🏛️ Nuovo Bilancio Partecipativo</h1>
        <p>Lancia una nuova votazione per la città. Assicurati che non ci siano altri bilanci attivi.</p>
      </div>

      <form @submit.prevent="handleSubmit">

        <div class="section">
          <h3>1. Dettagli Generali</h3>
          <div class="form-group">
            <label>Titolo del Bilancio</label>
            <input v-model="form.title" type="text" placeholder="Es. Bilancio Partecipativo 2026" required />
          </div>

          <div class="form-group">
            <label>Data di Scadenza</label>
            <input v-model="form.expirationDate" type="date" required />
            <small>La votazione si chiuderà automaticamente dopo questa data.</small>
          </div>
        </div>

        <hr>

        <div class="section">
          <h3>2. Opzioni di Voto (Esattamente 5)</h3>
          <p class="info-text">Inserisci le 5 proposte tra cui i cittadini dovranno scegliere.</p>

          <div class="options-grid">
            <div v-for="(opt, index) in form.options" :key="index" class="option-input-group">
              <span class="option-number">#{{ index + 1 }}</span>
              <input v-model="opt.text" type="text" :placeholder="'Opzione ' + (index + 1)" required maxlength="250" />
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="cancel-btn" @click="router.push('/')">Annulla</button>
          <button type="submit" class="submit-btn" :disabled="store.loading">
            {{ store.loading ? 'Creazione in corso...' : '🚀 Pubblica Bilancio' }}
          </button>
        </div>

        <p v-if="store.error" class="error-msg">{{ store.error }}</p>

      </form>
    </div>
  </div>
</template>

<style scoped>
.admin-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.admin-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--card-shadow);
}

.header {
  text-align: center;
  margin-bottom: 30px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 20px;
}

.header h1 {
  margin: 0;
  color: var(--accent-color);
}

.header p {
  color: var(--secondary-text);
  margin-top: 5px;
}

.section {
  margin-bottom: 30px;
}

.section h3 {
  color: #ffd700;
  margin-bottom: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
  box-sizing: border-box;
}

.form-group small {
  color: var(--secondary-text);
  font-size: 0.85rem;
}

.info-text {
  margin-bottom: 15px;
  color: var(--secondary-text);
  font-style: italic;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-input-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.option-number {
  font-weight: bold;
  color: var(--accent-color);
  width: 30px;
}

.option-input-group input {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
}

hr {
  border: 0;
  border-top: 1px solid var(--header-border);
  margin: 30px 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
}

.submit-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--secondary-text);
  color: var(--text-color);
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
}

.error-msg {
  color: #e74c3c;
  text-align: center;
  margin-top: 15px;
  font-weight: bold;
}
</style>
