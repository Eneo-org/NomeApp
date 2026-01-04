<script setup>
import { ref, onMounted } from 'vue';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useUserStore } from '../stores/userStore';
import { useRouter } from 'vue-router';

const initiativeStore = useInitiativeStore();
const userStore = useUserStore();
const router = useRouter();

// Dati del form
const form = ref({
  title: '',
  description: '',
  place: '',
  categoryId: '',
  imageUrl: '' // Per semplicità usiamo un URL diretto immagine
});

// Controllo Accesso: Se non è loggato, via da qui!
onMounted(() => {
  if (!userStore.isAuthenticated) {
    router.push('/login');
  }
  // Carichiamo le categorie per la select
  initiativeStore.fetchFiltersData();
});

const handleSubmit = async () => {
  // Validazione base
  if (!form.value.title || !form.value.categoryId) {
    alert("Compila i campi obbligatori.");
    return;
  }

  // Costruiamo l'oggetto come lo vuole il Backend (vedi controller)
  const payload = {
    title: form.value.title,
    description: form.value.description,
    place: form.value.place,
    categoryId: form.value.categoryId,
    attachments: []
  };

  // Se c'è un'immagine, la aggiungiamo all'array attachments
  if (form.value.imageUrl) {
    payload.attachments.push({
      fileName: 'Immagine Copertina',
      filePath: form.value.imageUrl,
      fileType: 'image/jpeg'
    });
  }

  const success = await initiativeStore.createInitiative(payload);

  if (success) {
    router.push('/'); // Torna alla home dopo il successo
  }
};
</script>

<template>
  <div class="create-container">
    <div class="form-card">
      <h1>🌱 Nuova Iniziativa</h1>
      <p>Proponi la tua idea per migliorare Trento.</p>

      <form @submit.prevent="handleSubmit">

        <div class="form-group">
          <label>Titolo *</label>
          <input v-model="form.title" type="text" placeholder="Es. Nuova pista ciclabile..." required />
        </div>

        <div class="form-group">
          <label>Categoria *</label>
          <select v-model="form.categoryId" required>
            <option value="" disabled>Seleziona una categoria</option>
            <option v-for="cat in initiativeStore.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Luogo</label>
          <input v-model="form.place" type="text" placeholder="Es. Via Belenzani" />
        </div>

        <div class="form-group">
          <label>Descrizione</label>
          <textarea v-model="form.description" rows="5"
            placeholder="Descrivi la tua proposta nel dettaglio..."></textarea>
        </div>

        <div class="form-group">
          <label>Immagine (URL)</label>
          <input v-model="form.imageUrl" type="text" placeholder="https://..." />
          <small>Incolla un link a un'immagine (es. da Unsplash)</small>
        </div>

        <button type="submit" class="submit-btn" :disabled="initiativeStore.loading">
          {{ initiativeStore.loading ? 'Pubblicazione...' : 'Pubblica Iniziativa' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.create-container {
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.form-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 30px;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  color: var(--text-color);
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
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
  box-sizing: border-box;
  /* Importante per non sbordare */
}

.submit-btn {
  width: 100%;
  background: var(--accent-color);
  color: white;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
