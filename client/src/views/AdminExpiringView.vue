<script setup>
import { ref, onMounted } from 'vue';
// Assumo tu stia usando il dashboardStore per le scadenze admin.
// Se usi un altro store, cambia questa importazione.
import { useDashboardStore } from '../stores/dashboardStore';
import defaultImage from '@/assets/placeholder-initiative.jpg';

const dashboardStore = useDashboardStore();
const API_URL = 'http://localhost:3000';

// Variabile reattiva per le iniziative
const initiatives = ref([]);

// --- HELPER FUNCTIONS ---

const getDaysLeft = (dateString) => {
  const today = new Date();
  const target = new Date(dateString);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  return new Date(dateString).toLocaleDateString('it-IT');
}

const getImageUrl = (item) => {
  if (!item.attachment || !item.attachment.filePath) {
    return defaultImage;
  }
  const cleanPath = item.attachment.filePath.replace(/\\/g, '/');
  return `${API_URL}/${cleanPath}`;
};

const goToReply = (id) => {
  // Logica di navigazione (assicurati di avere la rotta corretta)
  // router.push('/admin/reply/' + id);
  console.log("Vai a rispondere all'iniziativa", id);
}

// --- CARICAMENTO DATI ---
onMounted(async () => {
  // IMPORTANTE: Qui devi chiamare la funzione del tuo store che carica le scadenze.
  // Ho messo un nome generico 'fetchExpiringInitiatives', VERIFICA nel tuo 'dashboardStore.js' come si chiama.
  if (dashboardStore.fetchExpiringInitiatives) {
    await dashboardStore.fetchExpiringInitiatives();
    // Collega la variabile locale ai dati dello store
    initiatives.value = dashboardStore.expiringInitiatives || [];
  } else {
    console.warn("Attenzione: fetchExpiringInitiatives non trovata nel dashboardStore.");
    // Fallback: se usi un altro modo per caricare i dati, inseriscilo qui.
  }
});
</script>

<template>
  <div class="admin-wrapper">
    <div class="header-section">
      <h1 class="page-title">⏳ Monitoraggio Scadenze</h1>
      <p class="subtitle">Iniziative "Trento Partecipa" che richiedono risposta ufficiale.</p>
    </div>

    <div class="initiatives-list">
      <div v-for="item in initiatives" :key="item.id" class="card">

        <div class="card-image-wrapper">
          <img :src="getImageUrl(item)" class="card-img" alt="Immagine iniziativa">
          <div v-if="item.platformId !== 1" class="source-badge external">
            🔗 {{ item.platformName || 'Esterna' }}
          </div>
        </div>

        <div class="card-content">
          <div class="card-header">
            <h3>{{ item.title }}</h3>
            <div class="days-badge">
              - {{ getDaysLeft(item.expirationDate) }} giorni
            </div>
          </div>

          <div class="card-meta">
            <span>📍 {{ item.place || 'Trento' }}</span>
            <span>🏷️ {{ item.category }}</span>
            <span>📅 Scadenza: {{ formatDate(item.expirationDate) }}</span>
          </div>

          <div class="card-footer">
            <div class="signatures">
              <strong>🔥 {{ item.signatures }} Firme</strong>
            </div>
            <button class="action-btn" @click="goToReply(item.id)">
              📝 Vedi e Rispondi
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Contenitore Principale */
.admin-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 20px;
  color: var(--text-color);
}

.header-section {
  text-align: center;
  margin-bottom: 40px;
}

.page-title {
  font-size: 2.5rem;
  color: var(--accent-color);
  margin-bottom: 5px;
}

.subtitle {
  color: var(--secondary-text);
}

/* Griglia a 1 Colonna */
.initiatives-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

/* --- STILE CARD --- */
.card {
  display: flex;
  gap: 20px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  height: 180px;
  position: relative;
  box-shadow: var(--card-shadow);
  transition: transform 0.2s;
}

.card:hover {
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
}

.card-image-wrapper {
  flex: 0 0 220px;
  background: #333;
  position: relative;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-content {
  flex: 1;
  padding: 15px 20px 15px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-header {
  position: relative;
  padding-right: 140px;
}

.card-header h3 {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.2;
  color: var(--text-color);
}

/* Badge Rosso */
.days-badge {
  position: absolute;
  top: 0;
  right: 15px;
  background-color: #e74c3c;
  color: white;
  padding: 5px 12px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}

.source-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  z-index: 2;
  background-color: #d32f2f;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.card-meta {
  font-size: 0.9rem;
  color: var(--secondary-text);
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 5px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  border-top: 1px solid var(--header-border);
  padding-top: 10px;
}

.signatures {
  font-size: 0.95rem;
  color: var(--text-color);
}

.action-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .card {
    flex-direction: column;
    height: auto;
  }

  .card-image-wrapper {
    flex: none;
    height: 160px;
    width: 100%;
  }

  .card-content {
    padding: 15px;
  }

  .card-header {
    padding-right: 0;
    margin-bottom: 40px;
  }

  .days-badge {
    top: 35px;
    left: 0;
    right: auto;
  }
}
</style>
