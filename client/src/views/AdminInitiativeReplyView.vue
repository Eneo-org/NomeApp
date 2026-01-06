<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInitiativeStore } from '../stores/initiativeStore';

const route = useRoute();
const router = useRouter();
const store = useInitiativeStore();

const initiative = ref(null);
const loading = ref(true);

// Dati Form Risposta
const replyForm = ref({
  outcome: '', // "Accolta" o "Respinta"
  motivation: '',
  files: []
});

const fileInput = ref(null);

const loadDetail = async () => {
  loading.value = true;
  const data = await store.fetchInitiativeById(route.params.id);
  if (data) initiative.value = data;
  loading.value = false;
};

const handleFileChange = (event) => {
  replyForm.value.files = event.target.files;
};

const handleSubmit = async () => {
  // --- 1. VALIDAZIONE PREVENTIVA ---

  // Controllo Esito selezionato
  if (!replyForm.value.outcome) {
    alert("⚠️ Attenzione: Devi selezionare se l'iniziativa è 'Approvata' o 'Respinta'.");
    return; // Blocca la funzione qui, niente popup di conferma
  }

  // Controllo Lunghezza Motivazione (Quello che hai chiesto)
  const currentLength = replyForm.value.motivation.trim().length;
  if (currentLength < 10) {
    alert(`⚠️ Errore Validazione:\n\nLa motivazione è troppo corta (${currentLength} caratteri).\nIl sistema richiede almeno 10 caratteri per procedere.`);
    return; // Blocca la funzione qui, niente popup di conferma
  }

  // --- 2. RICHIESTA DI CONFERMA (Arriva qui solo se tutto è corretto) ---
  const confirmMsg = `Confermi di voler terminare l'iniziativa come "${replyForm.value.outcome}"?\n\nL'azione è irreversibile e verrà inviata una notifica all'autore.`;

  if (!confirm(confirmMsg)) return;

  // --- 3. INVIO DATI ---
  try {
    await store.submitAdminReply(
      initiative.value.id,
      replyForm.value.outcome,
      replyForm.value.motivation,
      replyForm.value.files
    );
    alert("✅ Risposta inviata con successo! Iniziativa conclusa.");
    router.push('/admin/expiring');
  } catch (error) {
    // Gestiamo anche l'errore che viene dal backend (es. 400 Bad Request) visualizzandolo bene
    alert("❌ Errore durante l'invio:\n" + error);
  }
};

onMounted(() => loadDetail());
</script>

<template>
  <div class="detail-container">
    <button @click="router.back()" class="back-link">← Torna alla lista</button>

    <div v-if="loading" class="loading">Caricamento...</div>

    <div v-else-if="initiative" class="content-wrapper">

      <div class="initiative-details">
        <span class="status-tag">Stato attuale: {{ initiative.status }}</span>
        <h1>{{ initiative.title }}</h1>
        <div class="meta-info">
          <span>📍 {{ initiative.place }}</span>
          <span>📅 Scadenza: {{ new Date(initiative.expirationDate).toLocaleDateString() }}</span>
          <span>✍️ Firme: {{ initiative.signatures }}</span>
        </div>
        <div class="description-box">
          <h3>Descrizione Originale</h3>
          <p>{{ initiative.description }}</p>
        </div>
      </div>

      <hr class="divider">

      <div class="admin-reply-section">
        <h2>🏛️ Risposta Ufficiale dell'Amministrazione</h2>
        <p>Compila questo modulo per concludere l'iniziativa.</p>

        <form @submit.prevent="handleSubmit" class="reply-form">

          <div class="form-group">
            <label>Esito Finale:</label>
            <div class="radio-group">
              <label class="radio-opt success">
                <input type="radio" value="Approvata" v-model="replyForm.outcome">
                ✅ Accogli Proposta
              </label>
              <label class="radio-opt danger">
                <input type="radio" value="Respinta" v-model="replyForm.outcome">
                🚫 Respingi Proposta
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>Motivazione Ufficiale (Obbligatoria):</label>
            <textarea v-model="replyForm.motivation" rows="6"
              placeholder="Scrivi qui la risposta dettagliata del Comune..." required></textarea>
          </div>

          <div class="form-group">
            <label>Allegati (Documenti ufficiali, Delibere):</label>
            <input type="file" multiple @change="handleFileChange" ref="fileInput" />
          </div>

          <button type="submit" class="submit-btn">Invia Risposta Definitiva</button>
        </form>
      </div>

    </div>
  </div>
</template>

<style scoped>
.detail-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
  color: var(--text-color);
}

.back-link {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  margin-bottom: 20px;
  font-size: 1rem;
}

.initiative-details {
  background: var(--card-bg);
  padding: 25px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
}

.status-tag {
  background: #3498db;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.meta-info {
  display: flex;
  gap: 20px;
  color: var(--secondary-text);
  margin: 10px 0 20px 0;
}

.description-box {
  background: rgba(0, 0, 0, 0.05);
  padding: 15px;
  border-radius: 8px;
}

.divider {
  margin: 40px 0;
  border-top: 2px dashed var(--card-border);
}

/* Form Styles */
.admin-reply-section {
  background: var(--card-bg);
  padding: 30px;
  border-radius: 12px;
  border: 1px solid var(--accent-color);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.admin-reply-section h2 {
  color: var(--accent-color);
  margin-top: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}

.form-group textarea {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
}

.radio-group {
  display: flex;
  gap: 20px;
}

.radio-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px solid var(--card-border);
  cursor: pointer;
}

.radio-opt.success:has(input:checked) {
  background: rgba(39, 174, 96, 0.2);
  border-color: #27ae60;
}

.radio-opt.danger:has(input:checked) {
  background: rgba(192, 57, 43, 0.2);
  border-color: #c0392b;
}

.submit-btn {
  width: 100%;
  padding: 15px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
}

.submit-btn:hover {
  background: var(--accent-hover);
}
</style>
