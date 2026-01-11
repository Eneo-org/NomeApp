<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useToastStore } from '../stores/toastStore';
import defaultImage from '@/assets/placeholder-initiative.jpg';

const route = useRoute();
const router = useRouter();
const store = useInitiativeStore();
const toast = useToastStore();

const initiative = ref(null);
const loading = ref(true);
const API_URL = 'http://localhost:3000';

// Stato locale per i file
const selectedFiles = ref([]); // Array per gestire i file aggiunti/rimossi

const replyForm = ref({
  outcome: '',
  motivation: '',
  // files non serve qui come ref diretta, la popoliamo al submit
});

const loadDetail = async () => {
  loading.value = true;
  const data = await store.fetchInitiativeById(route.params.id);
  if (data) initiative.value = data;
  loading.value = false;
};

const getImageUrl = computed(() => {
  if (!initiative.value) return defaultImage;
  const attachment = initiative.value.attachment || initiative.value.image;
  const path = attachment?.filePath || attachment;
  if (!path) return defaultImage;
  return `${API_URL}/${path.replace(/\\/g, '/')}`;
});

// --- GESTIONE FILE AVANZATA ---

const handleFileSelect = (event) => {
  const newFiles = Array.from(event.target.files);
  // Aggiungiamo i nuovi file a quelli già esistenti (evitiamo duplicati per nome se vuoi, qui li accetto tutti)
  selectedFiles.value = [...selectedFiles.value, ...newFiles];

  // Resettiamo l'input così se l'utente seleziona lo stesso file di nuovo, l'evento parte comunque
  event.target.value = '';
};

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1);
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- LOGICA PROROGA ---
const handleExtendDeadline = () => {
  toast.showToast(
    "Vuoi davvero prorogare la scadenza di 60 giorni?", 'prompt',
    {
      actions: [
        {
          label: '✅ Sì, Proroga', style: 'primary',
          onClick: async (toastId) => {
            toast.removeToast(toastId);
            try {
              await store.extendDeadline(initiative.value.id, initiative.value.expirationDate);
              toast.showToast("Scadenza aggiornata (+60gg)!", "success");
              await loadDetail();
            } catch (err) {
              toast.showToast("Errore durante la proroga.", "error");
            }
          }
        },
        { label: 'Annulla', style: 'secondary', onClick: (id) => toast.removeToast(id) }
      ]
    }
  );
};

// --- SUBMIT ---
const handleSubmit = () => {
  if (!replyForm.value.outcome) {
    toast.showToast("Devi selezionare un esito.", "error");
    return;
  }
  if (replyForm.value.motivation.trim().length < 10) {
    toast.showToast("La motivazione deve essere lunga almeno 10 caratteri.", "error");
    return;
  }

  toast.showToast(
    `Confermi l'invio della risposta come "${replyForm.value.outcome}"?`, 'prompt',
    {
      actions: [
        {
          label: '🚀 Invia Definitivamente', style: 'primary',
          onClick: async (toastId) => {
            toast.removeToast(toastId);
            try {
              // Passiamo l'array selectedFiles.value
              await store.submitAdminReply(
                initiative.value.id,
                replyForm.value.outcome,
                replyForm.value.motivation,
                selectedFiles.value
              );
              router.push('/admin/expiring');
            } catch (error) {
              // Errore gestito dallo store
            }
          }
        },
        { label: 'Annulla', style: 'secondary', onClick: (id) => toast.removeToast(id) }
      ]
    }
  );
};

onMounted(() => loadDetail());
</script>

<template>
  <div class="detail-container">
    <button @click="router.back()" class="back-link">← Torna alla lista</button>

    <div v-if="loading" class="loading">Caricamento...</div>

    <div v-else-if="initiative" class="content-wrapper">

      <div class="initiative-details">
        <div class="header-row">
          <span class="status-tag">{{ initiative.status }}</span>
        </div>
        <h1>{{ initiative.title }}</h1>
        <div class="detail-image-wrapper">
          <img :src="getImageUrl" alt="Immagine iniziativa" class="detail-img" />
        </div>
        <div class="meta-info">
          <span>📍 {{ initiative.place }}</span>
          <span>📅 Scadenza: {{ new Date(initiative.expirationDate).toLocaleDateString('it-IT') }}</span>
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

            <div class="upload-container">
              <label for="file-upload" class="custom-file-upload">
                📂 Clicca qui per aggiungere documenti
              </label>
              <input id="file-upload" type="file" multiple @change="handleFileSelect" />
            </div>

            <div v-if="selectedFiles.length > 0" class="files-list">
              <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-icon">📄</span>
                  <div class="file-details">
                    <span class="file-name">{{ file.name }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                  </div>
                </div>
                <button type="button" class="remove-file-btn" @click="removeFile(index)" title="Rimuovi file">
                  ❌
                </button>
              </div>
            </div>
            <div v-else class="no-files">
              <small>Nessun allegato selezionato.</small>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="extend-btn" @click="handleExtendDeadline">
              ⏳ Estendi Scadenza (+60gg)
            </button>
            <button type="submit" class="submit-btn">
              Invia Risposta Definitiva
            </button>
          </div>

        </form>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* STILI GENERALI */
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

.header-row {
  margin-bottom: 15px;
}

.status-tag {
  background: #3498db;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: bold;
}

.detail-image-wrapper {
  width: 100%;
  height: 300px;
  background-color: #333;
  border-radius: 8px;
  overflow: hidden;
  margin: 20px 0;
}

.detail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.meta-info {
  display: flex;
  gap: 20px;
  color: var(--secondary-text);
  margin: 10px 0 20px 0;
  font-size: 0.95rem;
}

.description-box {
  background: rgba(0, 0, 0, 0.05);
  padding: 20px;
  border-radius: 8px;
  line-height: 1.6;
}

.divider {
  margin: 40px 0;
  border-top: 2px dashed var(--card-border);
  opacity: 0.5;
}

/* ADMIN SECTION */
.admin-reply-section {
  background: var(--card-bg);
  padding: 30px;
  border-radius: 12px;
  border: 2px solid var(--accent-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
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
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
  font-family: inherit;
  resize: none;
}

.radio-group {
  display: flex;
  gap: 20px;
}

.radio-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 6px;
  border: 1px solid var(--card-border);
  cursor: pointer;
  flex: 1;
  justify-content: center;
  font-weight: bold;
}

.radio-opt.success:has(input:checked) {
  background: rgba(39, 174, 96, 0.15);
  border-color: #27ae60;
  color: #27ae60;
}

.radio-opt.danger:has(input:checked) {
  background: rgba(192, 57, 43, 0.15);
  border-color: #c0392b;
  color: #c0392b;
}

/* --- STILI UPLOAD CUSTOM --- */
/* Nascondi l'input file standard */
input[type="file"] {
  display: none;
}

.custom-file-upload {
  display: block;
  border: 2px dashed var(--header-border);
  background-color: var(--input-bg);
  padding: 15px;
  text-align: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  color: var(--secondary-text);
}

.custom-file-upload:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background-color: rgba(0, 0, 0, 0.02);
}

/* LISTA FILE */
.files-list {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--input-bg);
  border: 1px solid var(--header-border);
  padding: 8px 12px;
  border-radius: 6px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  /* Per nomi lunghi */
}

.file-details {
  display: flex;
  flex-direction: column;
}

.file-name {
  font-weight: bold;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.file-size {
  font-size: 0.75rem;
  color: var(--secondary-text);
}

.remove-file-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 5px;
  border-radius: 4px;
  transition: background 0.2s;
}

.remove-file-btn:hover {
  background-color: rgba(231, 76, 60, 0.2);
}

.no-files {
  margin-top: 5px;
  color: var(--secondary-text);
  font-style: italic;
}

/* AZIONI */
.form-actions {
  display: flex;
  gap: 15px;
  margin-top: 25px;
}

.extend-btn {
  flex: 1;
  background-color: #f39c12;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  padding: 16px;
  transition: background 0.2s;
}

.extend-btn:hover {
  background-color: #e67e22;
}

.submit-btn {
  flex: 2;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
  padding: 16px;
  transition: transform 0.1s;
}

.submit-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
}
</style>
