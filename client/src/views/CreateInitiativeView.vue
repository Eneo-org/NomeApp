<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useUserStore } from '../stores/userStore'
import { useToastStore } from '../stores/toastStore';
import { formatCooldownTime } from '@/utils/dateUtils';

const router = useRouter()
const route = useRoute()
const store = useInitiativeStore()
const userStore = useUserStore()
const toast = useToastStore();

const formData = ref({
  title: '',
  description: '',
  place: '',
  categoryId: ''
})

// MODIFICA: Gestiamo un array di file, non uno singolo
const selectedFiles = ref([])
const loading = ref(false)

onMounted(() => {
  store.fetchFiltersData()
  if (!userStore.isAuthenticated) {
    toast.showToast("Devi accedere per creare un'iniziativa", "error");
    router.push({ path: '/login', query: { redirect: route.fullPath } });
  }
})

// --- GESTIONE FILE AVANZATA ---
const handleFileSelect = (event) => {
  const newFiles = Array.from(event.target.files);
  // Aggiungiamo i file alla lista esistente
  selectedFiles.value = [...selectedFiles.value, ...newFiles];
  event.target.value = ''; // Reset input
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1);
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const handleSubmit = async () => {
  if (!formData.value.title || !formData.value.description || !formData.value.categoryId) {
    toast.showToast("⚠️ Compila tutti i campi obbligatori!", "error");
    return
  }

  loading.value = true

  // 1. CHECK COOLDOWN
  const status = await store.checkUserCooldown();
  if (status && status.allowed === false) {
    const timeString = formatCooldownTime(status.remainingMs);
    toast.showToast(`⛔ Devi attendere ancora: ${timeString}`, "error", { duration: 8000 });
    loading.value = false;
    return;
  }

  // 2. PREPARAZIONE PAYLOAD
  // Nota: Passiamo 'files' come array. Assicurati che lo store lo gestisca.
  const payload = {
    ...formData.value,
    platformId: 1,
    files: selectedFiles.value
  }

  const result = await store.createInitiative(payload)

  loading.value = false

  if (result.success && result.initiativeId) {
    console.log('🎯 Navigazione verso iniziativa:', result.initiativeId)
    // Naviga direttamente al dettaglio dell'iniziativa appena creata
    router.push(`/initiative/${result.initiativeId}`)
  } else if (result.success) {
    // Fallback se non abbiamo l'ID (non dovrebbe succedere)
    router.push('/')
  } else {
    if (!store.error) toast.showToast("Errore sconosciuto durante la creazione.", "error");
  }
}
</script>

<template>
  <div class="create-container">
    <h1>📝 Nuova Iniziativa</h1>
    <p class="subtitle">Proponi la tua idea per la città di Trento</p>

    <div class="form-card">
      <form @submit.prevent="handleSubmit">

        <div class="form-group">
          <label>Titolo *</label>
          <input v-model="formData.title" type="text" placeholder="Es. Nuova pista ciclabile..." required>
        </div>

        <div class="form-group">
          <label>Categoria *</label>
          <select v-model="formData.categoryId" required>
            <option value="" disabled>Seleziona una categoria</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Luogo (Opzionale)</label>
          <input v-model="formData.place" type="text" placeholder="Es. Piazza Duomo">
        </div>

        <div class="form-group">
          <label>Descrizione Dettagliata *</label>
          <textarea v-model="formData.description" rows="6" placeholder="Descrivi la tua proposta nel dettaglio..."
            required></textarea>
        </div>

        <div class="form-group">
          <label>Immagini o Documenti (Opzionale)</label>

          <div class="upload-container">
            <label for="file-upload" class="custom-file-upload">
              📂 Clicca per caricare file (Img, PDF)
            </label>
            <input id="file-upload" type="file" multiple @change="handleFileSelect" accept="image/*,.pdf" />
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
              <button type="button" class="remove-file-btn" @click="removeFile(index)">❌</button>
            </div>
          </div>
          <small class="hint" v-else>Nessun file selezionato.</small>
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="router.push('/')">Annulla</button>
          <button type="submit" class="submit-btn" :disabled="loading">
            {{ loading ? 'Pubblicazione...' : 'Pubblica Iniziativa' }}
          </button>
        </div>

      </form>
    </div>
  </div>
</template>

<style scoped>
.create-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.subtitle {
  color: var(--secondary-text);
  margin-bottom: 30px;
}

.form-card {
  background: var(--card-bg);
  padding: 30px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
  font-family: inherit;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
}

.hint {
  display: block;
  margin-top: 5px;
  font-size: 0.85rem;
  color: var(--secondary-text);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 30px;
}

.submit-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.2s;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--secondary-text);
  color: var(--text-color);
  padding: 12px 25px;
  border-radius: 8px;
  cursor: pointer;
}

/* --- STILI UPLOAD CUSTOM (Copiati da AdminReply) --- */
input[type="file"] {
  display: none;
}

.custom-file-upload {
  display: block;
  border: 2px dashed var(--header-border);
  background-color: var(--input-bg);
  padding: 20px;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  color: var(--secondary-text);
  font-weight: 500;
}

.custom-file-upload:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background-color: rgba(0, 0, 0, 0.02);
}

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
  padding: 10px;
  border-radius: 6px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
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
  transition: transform 0.2s;
}

.remove-file-btn:hover {
  transform: scale(1.2);
}
</style>
