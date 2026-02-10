<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
import { useImage } from '@/composables/useImage';
import defaultImage from '@/assets/placeholder-initiative.jpg';

// Usiamo la variabile d'ambiente corretta per i documenti (PDF), non localhost fisso!
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const route = useRoute();
const userStore = useUserStore();
const router = useRouter();
const initiativeStore = useInitiativeStore();
const toast = useToastStore();
const { getImageUrl } = useImage();

const initiative = ref(null);
const loading = ref(true);
const error = ref(null);

const initiativeId = computed(() => parseInt(route.params.id));

const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  return new Date(dateString).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
};

const currentUrl = computed(() => window.location.href);

const authorLabel = computed(() => {
  const firstName = initiative.value?.authorFirstName?.trim();
  const lastName = initiative.value?.authorLastName?.trim();
  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }
  return 'Cittadino';
});

const isUserSigned = computed(() => {
  return initiativeStore.hasSigned(initiativeId.value);
});

const loadInitiative = async (id) => {
  if (!id || isNaN(id)) {
    error.value = "ID iniziativa non valido.";
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  const data = await initiativeStore.fetchInitiativeDetail(id);

  if (data) {
    if (data.attachments) {
      data.images = data.attachments.filter(a => a.fileType.startsWith('image/'));
      data.documents = data.attachments.filter(a => !a.fileType.startsWith('image/'));
    }
    initiative.value = data;

    if (userStore.isAuthenticated) {
      await Promise.all([
        initiativeStore.fetchUserSignedIds(),
        initiativeStore.fetchUserFollowedIds()
      ]);
    }
  } else {
    error.value = "Impossibile trovare l'iniziativa richiesta.";
  }

  loading.value = false;
};

onMounted(() => loadInitiative(initiativeId.value));

watch(initiativeId, (newId, oldId) => {
  if (newId !== oldId && newId && !loading.value) {
    loadInitiative(newId);
  }
});

const handleSignClick = async () => {
  if (!initiative.value) return;

  if (isUserSigned.value) {
    toast.showToast("⚠️ Hai già firmato questa iniziativa!", "info");
    return;
  }

  if (!userStore.isAuthenticated) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }

  const result = await initiativeStore.signInitiative(initiative.value.id);

  if (result.success) {
    toast.showToast("✅ Firma registrata con successo!", "success");
    const updatedData = await initiativeStore.fetchInitiativeDetail(initiative.value.id);

    if (updatedData && updatedData.attachments) {
      updatedData.images = updatedData.attachments.filter(a => a.fileType.startsWith('image/'));
      updatedData.documents = updatedData.attachments.filter(a => !a.fileType.startsWith('image/'));
    }

    initiative.value = updatedData;

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
};

const handleFollowClick = async () => {
  if (!initiative.value) return;
  if (!userStore.isAuthenticated) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }
  await initiativeStore.toggleFollow(initiative.value.id, initiative.value.title);
};

const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(currentUrl.value);
    toast.showToast("Link copiato negli appunti!", "success");
  } catch (err) {
    toast.showToast("Impossibile copiare il link", "error");
  }
};

// --- MODIFICATO: Usa getImageUrl invece di costruire l'URL a mano ---
const mainImageSrc = computed(() => {
  if (!initiative.value || !initiative.value.images || initiative.value.images.length === 0) {
    console.log('[mainImageSrc] NO IMAGE:', initiative.value && initiative.value.images);
    return defaultImage;
  }
  const imgObj = initiative.value.images[currentImageIndex.value];
  console.log('[mainImageSrc] imgObj:', imgObj);
  return getImageUrl(imgObj);
});

const nextImage = () => {
  if (initiative.value && initiative.value.images.length > 1) {
    currentImageIndex.value = (currentImageIndex.value + 1) % initiative.value.images.length;
  }
};

const prevImage = () => {
  if (initiative.value && initiative.value.images.length > 1) {
    currentImageIndex.value = (currentImageIndex.value - 1 + initiative.value.images.length) % initiative.value.images.length;
  }
};

const currentImageIndex = ref(0);
const imageError = ref(false);

const handleImageError = (event) => {
  console.warn('⚠️ Errore caricamento immagine, uso placeholder');
  imageError.value = true;
  event.target.src = defaultImage;
};

watch(() => initiative.value?.id, () => {
  currentImageIndex.value = 0;
  imageError.value = false;
});

// Helper per i documenti (PDF): controlla se è URL assoluto o relativo
const getDocumentUrl = (filePath) => {
  if (!filePath) return '#';
  if (filePath.startsWith('http')) return filePath;
  const cleanPath = filePath.replace(/\\/g, '/');
  return `${API_URL}/${cleanPath}`;
}

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
          <button @click="router.back()" class="back-link">← Torna indietro</button>
        </nav>

        <div class="title-block">
          <div class="title-main">
            <h1>{{ initiative.title }}</h1>
            <div class="badges-row">
              <span class="status-badge" :class="initiative.status.toLowerCase().replace(' ', '-')">
                {{ initiative.status }}
              </span>
              <span v-if="initiative.platformId !== 1" class="platform-badge external">
                📤 Piattaforma: {{ initiativeStore.getPlatformName(initiative.platformId) }}
              </span>
            </div>
          </div>

          <button v-if="initiative.status === 'In corso'" class="btn-follow"
            :class="{ 'active': initiativeStore.isFollowed(initiative.id) }" @click="handleFollowClick">
            {{ initiativeStore.isFollowed(initiative.id) ? '⭐ Segui già' : '☆ Segui aggiornamenti' }}
          </button>
        </div>

        <div class="meta-info">
          <span class="meta-item category-item">🏷️ {{ initiativeStore.getCategoryName(initiative.categoryId) }}</span>
          <span class="meta-item">📍 {{ initiative.place || 'Trento' }}</span>
          <span class="meta-item">📅 Creato il {{ formatDate(initiative.creationDate) }}</span>
          <span class="meta-item author-item">👤 Autore: {{ authorLabel }}</span>
        </div>
      </header>

      <div class="layout-grid">

        <article class="main-content">
          <figure class="hero-image">
            <img :src="mainImageSrc" @error="handleImageError" alt="Immagine iniziativa">
            <div v-if="initiative.images && initiative.images.length > 1" class="gallery-nav">
              <button @click="prevImage" class="gallery-btn prev">‹</button>
              <button @click="nextImage" class="gallery-btn next">›</button>
            </div>
          </figure>

          <div v-if="initiative.images && initiative.images.length > 1" class="thumbnail-gallery">
            <img v-for="(image, index) in initiative.images" :key="image.id"
              :src="(console.log('[thumbnail] image:', image), getImageUrl(image))" @click="currentImageIndex = index"
              :class="{ 'active': currentImageIndex === index }" alt="Thumbnail">
          </div>

          <section class="description-box">
            <h3>Dettagli dell'iniziativa</h3>
            <p class="description-text">{{ initiative.description }}</p>
          </section>

          <section v-if="initiative.documents && initiative.documents.length > 0" class="attachments-box">
            <h3>Allegati scaricabili</h3>
            <ul>
              <li v-for="doc in initiative.documents" :key="doc.id">
                <a :href="getDocumentUrl(doc.filePath)" target="_blank" class="file-link">
                  📄 {{ doc.fileName }}
                </a>
              </li>
            </ul>
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
                    <a :href="getDocumentUrl(att.filePath)" target="_blank" class="file-link">
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
              <div class="signatures-display">
                <p class="signatures-count">
                  <span class="count-number">{{ initiative.signatures }}</span>
                  <span class="count-label">firme raccolte</span>
                </p>
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

              <div v-else class="external-initiative-box">
                <div class="external-platform-info">
                  <span class="platform-icon">🌐</span>
                  <div class="platform-details">
                    <span class="platform-label">Piattaforma di provenienza</span>
                    <span class="platform-name">{{ initiativeStore.getPlatformName(initiative.platformId) }}</span>
                  </div>
                </div>
                <p class="external-description">Questa iniziativa è ospitata su una piattaforma esterna. Per firmare o
                  partecipare, visita il sito originale.</p>
                <a :href="initiative.externalURL || '#'" target="_blank" rel="noopener noreferrer"
                  class="btn-external-cta">
                  Vai su {{ initiativeStore.getPlatformName(initiative.platformId) }} per firmare ↗
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
  background: none;
  border: none;
  padding: 0;
  text-decoration: none;
  color: var(--secondary-text);
  font-weight: 600;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s;
  cursor: pointer;
  font-family: inherit;
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
  position: relative;
}

.gallery-nav {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  transform: translateY(-50%);
  pointer-events: none;
}

.gallery-btn {
  pointer-events: all;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 10px;
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  transition: background-color 0.2s;
}

.gallery-btn:hover {
  background-color: rgba(0, 0, 0, 0.8);
}

.gallery-btn.prev {
  border-top-right-radius: 5px;
  border-bottom-right-radius: 5px;
}

.gallery-btn.next {
  border-top-left-radius: 5px;
  border-bottom-left-radius: 5px;
}

.thumbnail-gallery {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.thumbnail-gallery img {
  width: 80px;
  height: 60px;
  object-fit: cover;
  cursor: pointer;
  border-radius: 5px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.thumbnail-gallery img.active {
  border-color: var(--accent-color);
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

.signatures-display {
  text-align: center;
  margin-bottom: 25px;
  background-color: var(--input-bg);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--header-border);
}

.signatures-count {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.count-number {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--accent-color);
  line-height: 1;
  margin-right: 10px;
}

.count-label {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-color);
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

/* --- EXTERNAL INITIATIVE BOX --- */
.external-initiative-box {
  background: linear-gradient(135deg, var(--input-bg) 0%, rgba(52, 152, 219, 0.05) 100%);
  border: 2px solid var(--header-border);
  border-radius: 12px;
  padding: 25px;
  text-align: center;
}

.external-platform-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--header-border);
}

.platform-icon {
  font-size: 2.5rem;
  background: var(--accent-color);
  padding: 12px;
  border-radius: 12px;
  line-height: 1;
}

.platform-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.platform-label {
  font-size: 0.8rem;
  color: var(--secondary-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.platform-name {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text-color);
  margin-top: 2px;
}

.external-description {
  font-size: 0.95rem;
  color: var(--secondary-text);
  line-height: 1.6;
  margin-bottom: 20px;
}

.btn-external-cta {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: 18px 25px;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: center;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent-color) 0%, #2980b9 100%);
  color: white;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
  text-decoration: none;
}

.btn-external-cta:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4);
  background: linear-gradient(135deg, #2980b9 0%, var(--accent-color) 100%);
}

.btn-external-cta:active {
  transform: translateY(-1px);
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
