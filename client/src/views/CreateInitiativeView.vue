<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useInitiativeStore } from '../stores/initiativeStore'
// 1. IMPORTA TOAST
import { useToastStore } from '../stores/toastStore';

const router = useRouter()
const store = useInitiativeStore()
const toast = useToastStore(); // 2. ISTANZIA

const formData = ref({
  title: '',
  description: '',
  place: '',
  categoryId: ''
})

const selectedFile = ref(null)
const loading = ref(false)

onMounted(() => {
  store.fetchFiltersData()
})

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) selectedFile.value = file
}

const handleSubmit = async () => {
  // Validazione
  if (!formData.value.title || !formData.value.description || !formData.value.categoryId) {
    toast.showToast("⚠️ Compila tutti i campi obbligatori!", "error");
    return
  }

  loading.value = true

  const payload = {
    ...formData.value,
    platformId: 1,
    file: selectedFile.value
  }

  const success = await store.createInitiative(payload)

  loading.value = false

  if (success) {
    toast.showToast("🎉 Iniziativa creata con successo!", "success");
    router.push('/')
  } else {
    // Mostra l'errore che arriva dallo store o uno generico
    toast.showToast(store.error || "Errore durante la creazione.", "error");
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
          <label>Immagine (Opzionale)</label>
          <input type="file" @change="handleFileUpload" accept="image/*">
          <small class="hint">Carica un'immagine (JPG, PNG, WEBP).</small>
        </div>

        <div class="form-group">
          <label>Descrizione Dettagliata *</label>
          <textarea v-model="formData.description" rows="6" placeholder="Descrivi la tua proposta nel dettaglio..."
            required></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="router.push('/')">Annulla</button>
          <button type="submit" class="submit-btn" :disabled="loading">
            {{ loading ? 'Caricamento...' : 'Pubblica Iniziativa' }}
          </button>
        </div>

      </form>
    </div>
  </div>
</template>

<style scoped>
/* STILI INVARIATI (Rimosso solo .error-msg) */
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
</style>
