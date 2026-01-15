<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
import defaultImage from '@/assets/placeholder-initiative.jpg';

const API_URL = 'http://localhost:3000';

const route = useRoute();
const userStore = useUserStore();
const router = useRouter();
const initiativeStore = useInitiativeStore();
const toast = useToastStore();

const initiative = ref(null);
const loading = ref(true);
const error = ref(null);

// Recuperiamo l'ID dall'URL (convertiamo in numero per confronti sicuri)
const initiativeId = parseInt(route.params.id);

const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  return new Date(dateString).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
};

const currentUrl = computed(() => window.location.href);

// Computed: Controlla direttamente lo store per vedere se è firmata
// Questo rende il bottone reattivo: appena lo store si aggiorna, il bottone cambia
const isUserSigned = computed(() => {
  return initiativeStore.hasSigned(initiativeId);
});

onMounted(async () => {
  loading.value = true;

  // 1. Fetch Dettagli Iniziativa
  if (initiativeStore.categories.length === 0) {
    await initiativeStore.fetchFiltersData();
  }

  // 2. Fetch Iniziativa
  const data = await initiativeStore.fetchInitiativeDetail(initiativeId);

  if (data) {
    initiative.value = data;

    // 3. Fetch stato firme utente (Se loggato)
    // Questo aggiornerà lo store e di conseguenza la computed 'isUserSigned'
    if (userStore.isAuthenticated) {
      await initiativeStore.fetchUserSignedIds();
    }
  } else {
    error.value = "Impossibile trovare l'iniziativa richiesta.";
  }

  loading.value = false;
});

const handleSignClick = async () => {
  if (!initiative.value) return;

  // Controllo preventivo basato sullo store
  if (isUserSigned.value) {
    toast.showToast("⚠️ Hai già firmato questa iniziativa!", "info");
    return;
  }

  if (!userStore.isAuthenticated) {
    if (confirm("Devi accedere per firmare. Login?")) router.push('/login');
    return;
  }

  const result = await initiativeStore.signInitiative(initiative.value.id);

  if (result.success) {
    toast.showToast("✅ Firma registrata con successo!", "success");

    // Ricarica il dettaglio per aggiornare il contatore firme (es. da 50 a 51)
    const updatedData = await initiativeStore.fetchInitiativeDetail(initiative.value.id);
    initiative.value = updatedData;

    // Logica Prompt Notifiche
    const hidePrompt = localStorage.getItem('hideNotificationPrompt_v2');
    const alreadyFollowing = initiativeStore.isFollowed(initiative.value.id);

    if (!hidePrompt && !alreadyFollowing) {
      toast.showToast("Vuoi ricevere aggiornamenti?", 'prompt', {
        actions: [
          { label: '🔔 Sì', style: 'primary', onClick: async (id) => { await initiativeStore.ensureFollowed(initiative.value.id); toast.removeToast(id); toast.showToast("Notifiche attivate!", "success"); } },
          { label: 'No', style: 'secondary', onClick: (id) => toast.removeToast(id) },
          { label: 'Mai più', style: 'secondary', onClick: (id) => { localStorage.setItem('hideNotificationPrompt_v2', 'true'); toast.removeToast(id); } }
        ]
      });
    }
  }
  // Nota: Se result.success è false perché era già firmato (409),
  // lo store si è aggiornato da solo dentro signInitiative e il bottone diventerà grigio automaticamente.
};

const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(currentUrl.value);
    toast.showToast("Link copiato negli appunti!", "success");
  } catch (err) {
    toast.showToast("Impossibile copiare il link", "error");
  }
};

const mainImageSrc = computed(() => {
  if (!initiative.value) return defaultImage;
  if (initiative.value.attachments?.length > 0) {
    const cleanPath = initiative.value.attachments[0].filePath.replace(/\\/g, '/');
    return `${API_URL}/${cleanPath}`;
  }
  return defaultImage;
});

const progressPercentage = computed(() => {
  if (!initiative.value) return 0;
  return Math.min((initiative.value.signatures / 1000) * 100, 100);
});
</script>

<template>
  <div class="detail-page">

    <div v-if="loading" class="state-msg loading">
      <div class="spinner"></div>
      <p>Caricamento dettagli...</p>
    </div>

    <div v-else-if="error" class="state-msg error">
      <h3>😕 Ops! Qualcosa non va.</h3>
      <p>{{ error }}</p>
      <RouterLink to="/" class="btn-secondary">Torna alla Home</RouterLink>
    </div>

    <div v-else-if="initiative" class="content-wrapper">

      <header class="detail-header">
        <nav class="breadcrumbs">
          <RouterLink to="/" class="back-link">← Torna alla lista</RouterLink>
        </nav>

        <div class="title-block">
          <div class="title-main">
            <h1>{{ initiative.title }}</h1>
            <div class="badges-row">
              <span class="status-badge" :class="initiative.status.toLowerCase().replace(' ', '-')">
                {{ initiative.status }}
              </span>
              <span v-if="initiative.platformId !== 1" class="platform-badge external">
                Esterna: {{ initiativeStore.getPlatformName(initiative.platformId) }}
              </span>
            </div>
          </div>

          <button v-if="initiative.status === 'In corso'" class="btn-follow"
            :class="{ 'active': initiativeStore.isFollowed(initiative.id) }"
            @click="initiativeStore.toggleFollow(initiative.id, initiative.title)">
            {{ initiativeStore.isFollowed(initiative.id) ? '⭐ Segui già' : '☆ Segui aggiornamenti' }}
          </button>
        </div>

        <div class="meta-info">
          <span class="meta-item category-item">🏷️ {{ initiativeStore.getCategoryName(initiative.categoryId) }}</span>
          <span class="meta-item">📍 {{ initiative.place || 'Trento' }}</span>
          <span class="meta-item">📅 Creato il {{ formatDate(initiative.creationDate) }}</span>
          <span class="meta-item author-item">👤 Autore: Cittadino #{{ initiative.authorId }}</span>
        </div>
      </header>

      <div class="layout-grid">

        <article class="main-content">
          <figure class="hero-image">
            <img :src="mainImageSrc" alt="Immagine iniziativa">
          </figure>

          <section class="description-box">
            <h3>Dettagli dell'iniziativa</h3>
            <p class="description-text">{{ initiative.description }}</p>
          </section>

          <section v-if="initiative.reply" class="admin-reply">
            <div class="reply-header">
              <div class="admin-avatar">🏛️</div>
              <div>
                <h4>Risposta Ufficiale del Comune</h4>
                <span class="reply-date">{{ formatDate(initiative.reply.creationDate) }}</span>
              </div>
            </div>
            <div class="reply-body">
              <p>{{ initiative.reply.replyText }}</p>
              <div v-if="initiative.reply.attachments?.length" class="attachments-box">
                <h5>Allegati scaricabili:</h5>
                <ul>
                  <li v-for="att in initiative.reply.attachments" :key="att.id">
                    <a :href="`${API_URL}/${att.filePath.replace(/\\/g, '/')}`" target="_blank" class="file-link">
                      📄 {{ att.fileName }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </article>

        <aside class="sidebar">

          <div class="card action-card">
            <div class="card-header no-border">
              <h3>Sostieni questa iniziativa</h3>
            </div>

            <div class="card-body pt-0">
              <div class="progress-section">
                <div class="progress-info">
                  <span class="current-sigs">{{ initiative.signatures }} <small>firme</small></span>
                  <span class="target-sigs">Obiettivo: 1000</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
                </div>
              </div>

              <div v-if="initiative.platformId === 1">
                <button @click="handleSignClick" class="btn-sign" :class="{ 'signed': isUserSigned }"
                  :disabled="initiative.status !== 'In corso' || (userStore.isAuthenticated && !userStore.canVote)">
                  <span v-if="isUserSigned">Hai già firmato</span>
                  <span v-else-if="userStore.isAuthenticated && !userStore.canVote">⛔ Solo Cittadini</span>
                  <span v-else-if="initiative.status === 'In corso'">Firma l'iniziativa</span>
                  <span v-else>Raccolta firme conclusa</span>
                </button>
                <p class="deadline-text">Hai tempo fino al {{ formatDate(initiative.expirationDate) }}</p>
              </div>

              <div v-else class="external-info">
                <p>Questa petizione è gestita su una piattaforma esterna.</p>
                <a :href="initiative.externalURL || '#'" target="_blank" class="btn-external">
                  Vai al sito esterno ↗
                </a>
              </div>
            </div>
          </div>

          <div class="card share-card">
            <div class="card-header no-border">
              <h4>Condividi iniziativa</h4>
            </div>
            <div class="card-body pt-0">
              <div class="share-input-group">
                <input type="text" :value="currentUrl" readonly class="share-url-input"
                  aria-label="URL dell'iniziativa">
                <button @click="handleCopyLink" class="btn-copy-link">
                  Copia Link
                </button>
              </div>
            </div>
          </div>

        </aside>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- VARIABILI & RESET --- */
.detail-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* UTILITY */
.pt-0 {
  padding-top: 0 !important;
}

.no-border {
  border-bottom: none !important;
}

/* --- STATI CARICAMENTO --- */
.state-msg {
  text-align: center;
  padding: 80px 20px;
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  margin-top: 40px;
}

.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top: 3px solid var(--accent-color);
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.btn-secondary {
  display: inline-block;
  margin-top: 20px;
  text-decoration: none;
  padding: 10px 20px;
  border: 1px solid var(--header-border);
  border-radius: 8px;
  color: var(--text-color);
}

/* --- HEADER --- */
.detail-header {
  margin-bottom: 50px;
}

.breadcrumbs {
  margin-bottom: 25px;
}

.back-link {
  text-decoration: none;
  color: var(--secondary-text);
  font-weight: 600;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--accent-color);
}

.title-block {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 30px;
  margin-bottom: 25px;
}

.title-main h1 {
  font-size: 2.8rem;
  line-height: 1.2;
  margin: 0 0 15px 0;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.badges-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.status-badge {
  padding: 6px 14px;
  border-radius: 30px;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: white;
  letter-spacing: 0.5px;
}

.status-badge.in-corso {
  background-color: #3498db;
  box-shadow: 0 2px 10px rgba(52, 152, 219, 0.3);
}

.status-badge.approvata {
  background-color: #27ae60;
  box-shadow: 0 2px 10px rgba(39, 174, 96, 0.3);
}

.status-badge.respinta {
  background-color: #e74c3c;
}

.status-badge.scaduta {
  background-color: #7f8c8d;
}

.platform-badge.external {
  background: var(--input-bg);
  color: var(--secondary-text);
  border: 1px solid var(--header-border);
  padding: 6px 14px;
  border-radius: 30px;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-follow {
  background: transparent;
  border: 2px solid var(--header-border);
  padding: 10px 20px;
  border-radius: 30px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  color: var(--text-color);
  font-size: 0.95rem;
}

.btn-follow:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(0, 0, 0, 0.02);
}

.btn-follow.active {
  border-color: #f1c40f;
  background: rgba(241, 196, 15, 0.15);
  color: #f39c12;
}

.meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 30px;
  color: var(--secondary-text);
  font-size: 0.95rem;
  border-top: 1px solid var(--header-border);
  padding-top: 20px;
  align-items: center;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.category-item {
  color: var(--text-color);
  font-weight: 700;
}

/* --- GRID LAYOUT --- */
.layout-grid {
  display: grid;
  grid-template-columns: 7fr 4fr;
  gap: 50px;
  align-items: start;
}

/* --- CONTENUTO (SX) --- */
.main-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.hero-image {
  width: 100%;
  height: 450px;
  background: #2c3e50;
  border-radius: 16px;
  overflow: hidden;
  margin: 0;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.2);
}

.hero-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.description-box h3 {
  font-size: 1.8rem;
  margin-bottom: 20px;
  color: var(--text-color);
  font-weight: 700;
}

.description-text {
  font-size: 1.15rem;
  line-height: 1.8;
  color: var(--text-color);
  white-space: pre-line;
  opacity: 0.9;
}

/* RISPOSTA ADMIN */
.admin-reply {
  background: var(--card-bg);
  border-left: 5px solid var(--accent-color);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--card-shadow);
  margin-top: 20px;
  position: relative;
  overflow: hidden;
}

.admin-reply::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--accent-color);
  opacity: 0.05;
  pointer-events: none;
}

.reply-header {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-bottom: 25px;
  position: relative;
}

.admin-avatar {
  font-size: 2.5rem;
}

.reply-header h4 {
  margin: 0 0 5px 0;
  font-size: 1.4rem;
  color: var(--accent-color);
  font-weight: 700;
}

.reply-date {
  font-size: 0.9rem;
  color: var(--secondary-text);
}

.reply-body p {
  margin-bottom: 20px;
  line-height: 1.7;
  font-size: 1.1rem;
  position: relative;
}

.attachments-box {
  background: var(--input-bg);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--header-border);
  position: relative;
}

.attachments-box h5 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  color: var(--secondary-text);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.attachments-box ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-link {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
  transition: background 0.2s;
}

.file-link:hover {
  background: rgba(0, 0, 0, 0.03);
  color: var(--accent-color);
}

/* --- SIDEBAR (DX) --- */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  overflow: hidden;
  margin-bottom: 30px;
}

.card-header {
  padding: 25px 30px;
  background: transparent;
}

.card-header h3,
.card-header h4 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
}

.card-body {
  padding: 25px 30px;
}

/* Progress Bar */
.progress-section {
  margin-bottom: 30px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.current-sigs {
  font-size: 2rem;
  font-weight: 800;
  color: var(--accent-color);
  line-height: 1;
}

.current-sigs small {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-color);
  margin-left: 5px;
}

.target-sigs {
  font-size: 0.9rem;
  color: var(--secondary-text);
  font-weight: 600;
  text-transform: uppercase;
}

.progress-track {
  background: var(--input-bg);
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid var(--header-border);
}

.progress-fill {
  background: var(--accent-color);
  height: 100%;
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 7px;
}

/* Bottone Firma */
.btn-sign {
  width: 100%;
  padding: 18px;
  font-size: 1.2rem;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  letter-spacing: 0.5px;
}

.btn-sign:hover:not(:disabled):not(.signed) {
  background: var(--accent-hover);
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.btn-sign:active:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.btn-sign:disabled {
  background: var(--input-bg);
  color: var(--secondary-text);
  border: 1px solid var(--header-border);
  cursor: not-allowed;
  box-shadow: none;
  opacity: 0.8;
  font-weight: 600;
}

.btn-sign.signed {
  background: #2c3e50;
  color: rgba(255, 255, 255, 0.8);
  cursor: default;
  box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.3);
}

.deadline-text {
  text-align: center;
  font-size: 0.9rem;
  color: var(--secondary-text);
  margin-top: 18px;
  font-weight: 500;
}

.external-info {
  text-align: center;
  padding: 20px;
  background: var(--input-bg);
  border-radius: 10px;
  border: 2px dashed var(--header-border);
}

.btn-external {
  display: inline-block;
  margin-top: 15px;
  color: var(--accent-color);
  font-weight: 700;
  text-decoration: none;
  font-size: 1rem;
}

.btn-external:hover {
  text-decoration: underline;
}

/* Share Input Group */
.share-input-group {
  display: flex;
  border: 1px solid var(--header-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--input-bg);
}

.share-url-input {
  flex: 1;
  border: none;
  padding: 15px;
  font-size: 0.95rem;
  color: var(--secondary-text);
  background: transparent;
  outline: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-copy-link {
  border: none;
  background: var(--input-bg);
  border-left: 1px solid var(--header-border);
  padding: 0 25px;
  font-weight: 700;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
  white-space: nowrap;
}

.btn-copy-link:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--accent-color);
}

/* --- RESPONSIVE --- */
@media (max-width: 992px) {
  .layout-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .title-block {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .btn-follow {
    width: 100%;
    text-align: center;
  }

  .hero-image {
    height: 350px;
  }

  .sidebar {
    order: -1;
    /* La sidebar va sopra su mobile se preferisci, altrimenti rimuovi */
  }
}

@media (max-width: 768px) {
  .detail-page {
    padding: 20px 15px;
  }

  .title-main h1 {
    font-size: 2rem;
  }

  .hero-image {
    height: 250px;
  }

  .meta-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .admin-reply {
    padding: 20px;
  }

  .reply-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .card-header,
  .card-body {
    padding: 20px;
  }
}
</style>
