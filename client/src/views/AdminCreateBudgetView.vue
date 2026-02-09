<script setup>

import { ref } from 'vue';
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore';
import { useRouter } from 'vue-router';
import { useToastStore } from '../stores/toastStore';

const store = useParticipatoryBudgetStore();
const router = useRouter();
const toast = useToastStore();

// Stato del form - Ora parte con 3 opzioni
const form = ref({
  title: '',
  expirationDate: '',
  options: [
    { text: '' },
    { text: '' },
    { text: '' }
  ]
});

// Funzione per aggiungere una nuova opzione
const addOption = () => {
  if (form.value.options.length < 5) {
    form.value.options.push({ text: '' });
  }
};

// Funzione per rimuovere un'opzione
const removeOption = (index) => {
  if (form.value.options.length > 3) {
    form.value.options.splice(index, 1);
  }
};

const handleSubmit = async () => {
  // Validazione di base
  if (!form.value.title || !form.value.expirationDate) {
    toast.showToast("Inserisci titolo e data di scadenza.", "error");
    return;
  }

  // Assegna le posizioni
  const optionsWithPos = form.value.options.map((opt, index) => ({ ...opt, position: index + 1 }));

  // Validazione: nessuna opzione deve essere vuota
  const emptyOption = optionsWithPos.find(opt => !opt.text || opt.text.trim() === '');
  if (emptyOption) {
    toast.showToast("Tutte le opzioni devono essere compilate.", "error");
    return;
  }

  // Validazione sul numero di opzioni
  if (optionsWithPos.length < 3 || optionsWithPos.length > 5) {
    toast.showToast("Devi inserire da 3 a 5 opzioni.", "error");
    return;
  }

  // Prepara l'oggetto da inviare
  const payload = {
    ...form.value,
    options: optionsWithPos
  };

  const success = await store.createParticipatoryBudget(payload);

  if (success) {
    toast.showToast("Bilancio creato con successo! 🎉", "success");
    router.push('/');
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
          <h3>2. Opzioni di Voto (Da 3 a 5)</h3>
          <p class="info-text">Inserisci da 3 a 5 proposte tra cui i cittadini sceglieranno.</p>

          <div class="options-grid">
            <div v-for="(opt, index) in form.options" :key="index" class="option-input-group">
              <span class="option-number">#{{ index + 1 }}</span>
              <input v-model="opt.text" type="text" :placeholder="'Testo opzione ' + (index + 1)" required
                maxlength="250" />
              <button v-if="form.options.length > 3" @click="removeOption(index)" type="button"
                class="option-btn remove-btn" title="Rimuovi opzione">
                &ndash;
              </button>
            </div>
          </div>

          <div class="add-option-container">
            <button v-if="form.options.length < 5" @click="addOption" type="button" class="option-btn add-btn">
              + Aggiungi opzione
            </button>
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

.add-option-container {
  margin-top: 15px;
}

.option-btn {
  border: none;
  cursor: pointer;
  border-radius: 6px;
  font-weight: bold;
  transition: all 0.2s;
  padding: 8px 12px;
  font-size: 0.9rem;
}

.add-btn {
  background-color: #2c3e50;
  color: white;
  border: 1px solid #34495e;
}

.add-btn:hover {
  background-color: #34495e;
}

.remove-btn {
  background-color: #c0392b;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background-color: #e74c3c;
}
</style>
