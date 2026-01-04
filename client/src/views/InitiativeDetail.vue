<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useInitiativeStore } from '../stores/initiativeStore';

const route = useRoute();
// CHANGE: Rename 'store' to 'initiativeStore' to match template usage
const initiativeStore = useInitiativeStore();

// Stato locale per questa pagina
const initiative = ref(null);
const loading = ref(true);
const error = ref(null);

// Recuperiamo l'ID dall'URL
const initiativeId = route.params.id;

// Helper per le date
const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
};

// Caricamento Dati
onMounted(async () => {
  loading.value = true;
  // CHANGE: Use initiativeStore instead of store
  const data = await initiativeStore.fetchInitiativeDetail(initiativeId);

  if (data) {
    initiative.value = data;
  } else {
    error.value = "Impossibile trovare l'iniziativa richiesta.";
  }
  loading.value = false;
});

// Funzione per Firmare
const handleSign = async () => {
  if (!initiative.value) return;

  // CHANGE: Use initiativeStore instead of store
  const success = await initiativeStore.signInitiative(initiative.value.id);
  if (success) {
    // Se la firma va a buon fine, ricarichiamo i dati per aggiornare il contatore
    const updatedData = await initiativeStore.fetchInitiativeDetail(initiativeId);
    initiative.value = updatedData;
    alert("Grazie per il tuo sostegno! Firma registrata.");
  }
};

// Calcolo percentuale progress bar (esempio: target 1000 firme)
const progressPercentage = computed(() => {
  if (!initiative.value) return 0;
  const target = 1000;
  return Math.min((initiative.value.signatures / target) * 100, 100);
});
</script>

<template>
  <div class="detail-container">

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Caricamento dettagli iniziativa...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <h3>😕 Ops! Qualcosa non va.</h3>
      <p>{{ error }}</p>
      <RouterLink to="/" class="back-link">Torna alla Home</RouterLink>
    </div>

    <div v-else-if="initiative" class="content-wrapper">

      <header class="detail-header-block">
        <div class="header-top">
          <RouterLink to="/" class="back-btn">← Torna indietro</RouterLink>
          <span class="category-badge">{{ initiativeStore.getCategoryName(initiative.categoryId) }}</span>
        </div>

        <div class="title-row">
          <h1>{{ initiative.title }}</h1>

          <button v-if="initiative.status === 'In corso'" class="follow-btn-large"
            :class="{ 'active': initiativeStore.isFollowed(initiative.id) }"
            @click="initiativeStore.toggleFollow(initiative.id, initiative.title)">
            {{ initiativeStore.isFollowed(initiative.id) ? '⭐ Segui già' : '☆ Segui' }}
          </button>
        </div>

        <div class="meta-row">
          <span class="status-badge" :class="initiative.status.toLowerCase().replace(' ', '-')">
            {{ initiative.status }}
          </span>
          <span>📍 {{ initiative.place || 'Trento' }}</span>
          <span>📅 Creato il {{ formatDate(initiative.creationDate) }}</span>
        </div>
      </header>

      <div class="main-grid">

        <div class="left-col">

          <div v-if="initiative.attachments && initiative.attachments.length > 0" class="main-image">
            <img :src="initiative.attachments[0].filePath" alt="Allegato Iniziativa">
          </div>

          <section class="description-section">
            <h3>Descrizione</h3>
            <p class="description-text">{{ initiative.description }}</p>
          </section>

          <section v-if="initiative.reply" class="admin-reply-section">
            <div class="reply-header">
              <h3>🏛️ Risposta dell'Amministrazione</h3>
              <span class="reply-date">{{ formatDate(initiative.reply.creationDate) }}</span>
            </div>
            <div class="reply-content">
              <p>{{ initiative.reply.replyText }}</p>

              <div v-if="initiative.reply.attachments && initiative.reply.attachments.length > 0"
                class="attachments-list">
                <h4>Allegati alla risposta:</h4>
                <ul>
                  <li v-for="att in initiative.reply.attachments" :key="att.id">
                    📄 <a :href="att.filePath" target="_blank">{{ att.fileName }}</a>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <aside class="right-col">
          <div class="action-card">
            <h3>Sostieni questa iniziativa</h3>

            <div class="progress-box">
              <div class="progress-labels">
                <strong>{{ initiative.signatures }}</strong> firme raccolte
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" :style="{ width: progressPercentage + '%' }"></div>
              </div>
              <p class="target-text">Obiettivo indicativo: 1000 firme</p>
            </div>

            <button @click="handleSign" class="sign-btn" :disabled="initiative.status !== 'In corso'">
              ✍️ {{ initiative.status === 'In corso' ? 'Firma Iniziativa' : 'Firme Chiuse' }}
            </button>

            <p class="scadenza-info">Scade il: {{ formatDate(initiative.expirationDate) }}</p>
          </div>

          <div class="info-card">
            <h4>Proposto da:</h4>
            <div class="author-row">
              <div class="avatar-placeholder">👤</div>
              <span>Cittadino #{{ initiative.authorId }}</span>
            </div>
          </div>
        </aside>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout Base */
.detail-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.back-btn {
  text-decoration: none;
  color: var(--secondary-text);
  font-weight: bold;
  font-size: 0.9rem;
}

.back-btn:hover {
  color: var(--accent-color);
}

/* Header */
.detail-header-block {
  margin-bottom: 40px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.category-badge {
  background: var(--card-border);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Title Row to align title and follow button */
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.title-row h1 {
  font-size: 2.5rem;
  margin: 0;
  line-height: 1.2;
}

.meta-row {
  display: flex;
  gap: 20px;
  align-items: center;
  color: var(--secondary-text);
  font-size: 1rem;
}

.status-badge {
  padding: 5px 12px;
  border-radius: 6px;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
  font-size: 0.8rem;
}

.status-badge.in-corso {
  background-color: #1565c0;
}

.status-badge.approvata {
  background-color: #2e7d32;
}

.status-badge.respinta {
  background-color: #c62828;
}

/* Grid Layout */
.main-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 40px;
}

/* Sinistra */
.main-image {
  width: 100%;
  height: 350px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 30px;
  background-color: #333;
}

.main-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.description-text {
  font-size: 1.1rem;
  line-height: 1.6;
  white-space: pre-line;
}

/* Risposta Admin */
.admin-reply-section {
  margin-top: 40px;
  background: rgba(66, 185, 131, 0.1);
  border: 1px solid var(--accent-color);
  border-radius: 12px;
  padding: 25px;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 10px;
}

.reply-header h3 {
  margin: 0;
  color: var(--accent-color);
}

/* Destra (Sidebar azioni) */
.action-card,
.info-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 25px;
  border-radius: 12px;
  box-shadow: var(--card-shadow);
  margin-bottom: 20px;
}

.sign-btn {
  width: 100%;
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 15px;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
  margin-top: 20px;
}

.sign-btn:hover:not(:disabled) {
  transform: scale(1.02);
  background: #3aa876;
}

.sign-btn:disabled {
  background: #777;
  cursor: not-allowed;
}

.progress-box {
  margin-top: 15px;
}

.progress-bar-bg {
  background: #ddd;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  margin: 10px 0;
}

.progress-bar-fill {
  background: var(--accent-color);
  height: 100%;
}

.target-text {
  font-size: 0.8rem;
  color: #888;
  text-align: right;
  margin: 0;
}

.scadenza-info {
  margin-top: 15px;
  text-align: center;
  font-size: 0.9rem;
  color: #888;
}

/* Follow Button Styles */
.follow-btn-large {
  background: transparent;
  border: 2px solid #ccc;
  padding: 8px 15px;
  border-radius: 30px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
  color: var(--text-color);
  transition: all 0.2s;
}

.follow-btn-large.active {
  border-color: #f1c40f;
  background-color: rgba(241, 196, 15, 0.1);
  color: #f39c12;
}

.follow-btn-large:hover {
  border-color: #f1c40f;
}

/* Responsive */
@media (max-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr;
  }

  .title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .title-row h1 {
    font-size: 1.8rem;
  }

  .meta-row {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>
