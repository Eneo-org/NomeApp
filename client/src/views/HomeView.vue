<script setup>
import { ref, onMounted, watch } from 'vue'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'
import { useUserStore } from '../stores/userStore'
import { useToastStore } from '../stores/toastStore';
import { useImage } from '@/composables/useImage';
import ParticipatoryBudgetCard from '@/components/ParticipatoryBudgetCard.vue'
import { useRouter } from 'vue-router';

const initiativeStore = useInitiativeStore()
const budgetStore = useParticipatoryBudgetStore()
const userStore = useUserStore()
const toast = useToastStore();
const router = useRouter();
const { getImageUrl } = useImage();

// --- STATO TOAST PERSONALIZZATO ---
const showNotificationPrompt = ref(false);
const lastSignedInitiative = ref(null);

const page = ref(1);
const sort = ref('signatures');
const filters = ref({
  search: '',
  category: '',
  platform: '',
  status: 'In corso'
});

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}

// --- INIT ---
onMounted(async () => {
  await initiativeStore.fetchFiltersData()
  loadData()
  budgetStore.fetchActiveBudget()
  if (userStore.isAuthenticated) {
    await initiativeStore.fetchUserFollowedIds();
  }
})

const loadData = async () => {
  await initiativeStore.fetchInitiatives(page.value, sort.value, filters.value);
};

// --- NAVIGAZIONE ---
const nextPage = () => {
  if (initiativeStore.currentPage < initiativeStore.totalPages) {
    page.value++;
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const prevPage = () => {
  if (page.value > 1) {
    page.value--;
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const applyFilters = () => {
  initiativeStore.currentPage = 1
  page.value = 1;
  loadData()
}

const resetFilters = () => {
  filters.value = {
    search: '',
    category: '',
    platform: '',
    status: 'In corso'
  }
  applyFilters()
}

// --- LOGICA STELLINA (SEMPLIFICATA) ---
const handleStarClick = async (item) => {
  if (!userStore.isAuthenticated) {
    if (confirm("Devi accedere per seguire le iniziative. Vuoi andare al login?")) {
      router.push('/login');
    }
    return;
  }

  // DELEGIAMO TUTTO ALLO STORE!
  // Niente logica locale qui, evita conflitti e doppi messaggi.
  await initiativeStore.toggleFollow(item.id, item.title);
};

// --- LOGICA FIRMA (Invariata, ma pulita) ---
const handleSign = async (item) => {
  if (!userStore.isAuthenticated) {
    if (confirm("Devi accedere per firmare. Vuoi andare al login?")) {
      router.push('/login');
    }
    return;
  }

  const result = await initiativeStore.signInitiative(item.id);

  if (result.success) {
    // 1. Toast di Successo Standard
    toast.showToast("✅ Firma registrata con successo!", "success");

    // 2. Controllo Prompt (INTEGRATO NEI TOAST)
    const hidePrompt = localStorage.getItem('hideNotificationPrompt');
    if (!hidePrompt) {

      // Creiamo il Toast "Prompt" interattivo
      toast.showToast(
        `Vuoi ricevere notifiche sugli aggiornamenti di "${item.title}"?`,
        'prompt', // Tipo nuovo (giallo)
        {
          actions: [
            {
              label: '🔔 Tienimi aggiornato',
              style: 'primary',
              onClick: async (toastId) => {
                // Logica SI
                await initiativeStore.ensureFollowed(item.id);
                toast.removeToast(toastId); // Chiudi il prompt
                toast.showToast(`Notifiche attivate per "${item.title}"!`, 'success');
              }
            },
            {
              label: 'Non ora',
              style: 'secondary',
              onClick: (toastId) => {
                // Logica NO
                toast.removeToast(toastId);
              }
            },
            {
              label: 'Non chiedere più',
              style: 'secondary',
              onClick: (toastId) => {
                // Logica MAI PIÙ
                localStorage.setItem('hideNotificationPrompt', 'true');
                toast.removeToast(toastId);
                toast.showToast('Preferenza salvata.', 'info');
              }
            }
          ]
        }
      );
    }
  }
};

// --- AZIONI BOTTONI TOAST ---
const enableNotifications = async () => {
  if (lastSignedInitiative.value) {
    // Usiamo lo store per assicurarci che sia tra i preferiti
    await initiativeStore.ensureFollowed(lastSignedInitiative.value.id);
  }
  toast.showToast(`🔔 Notifiche attivate per "${lastSignedInitiative.value?.title}"!`, "success");
  showNotificationPrompt.value = false;
};

const ignorePrompt = () => {
  showNotificationPrompt.value = false;
};

const disablePromptForever = () => {
  localStorage.setItem('hideNotificationPrompt', 'true');
  showNotificationPrompt.value = false;
  toast.showToast("Preferenza salvata.", "info");
};

const getStatusClass = (status) => {
  if (!status) return 'status-default';
  const s = status.toLowerCase();
  if (s === 'in corso') return 'status-active';
  if (s === 'approvata') return 'status-success';
  if (s === 'respinta') return 'status-danger';
  if (s === 'scaduta') return 'status-muted';
  return 'status-default';
};

watch(() => filters.value.category, applyFilters)
watch(() => filters.value.platform, applyFilters)
</script>

<template>
  <div class="home-wrapper">
    <div class="app-header">
      <h1 class="main-title">TRENTO PARTECIPA</h1>
      <p class="subtitle">La piattaforma per i cittadini attivi</p>
    </div>

    <div class="main-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h3>🔍 Filtra Iniziative</h3>
          <button @click="resetFilters" class="reset-link">Azzera</button>
        </div>
        <div class="filter-group">
          <label>Cerca</label>
          <input v-model="filters.search" type="text" placeholder="Parole chiave..." @keyup.enter="applyFilters">
        </div>
        <div class="filter-group">
          <label>Categoria</label>
          <select v-model="filters.category" @change="applyFilters">
            <option value="">Tutte le categorie</option>
            <option v-for="cat in initiativeStore.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Piattaforma</label>
          <select v-model="filters.platform" @change="applyFilters">
            <option value="">Tutte le piattaforme</option>
            <option v-for="p in initiativeStore.platforms" :key="p.id" :value="p.id">
              {{ p.platformName }}
            </option>
          </select>
        </div>
        <div class="sidebar-actions" v-if="userStore.isAuthenticated">
          <hr>
          <RouterLink to="/create"><button class="create-btn full-width">+ Crea Nuova</button></RouterLink>
        </div>
      </aside>

      <main class="content-area">
        <ParticipatoryBudgetCard />
        <div class="results-header">
          <h2>Esplora le Iniziative</h2>
          <span class="count-badge">{{ initiativeStore.totalObjects }} Iniziative attive</span>
        </div>

        <div v-if="initiativeStore.loading" class="loading-msg">Caricamento in corso...</div>

        <div v-else-if="initiativeStore.initiatives.length > 0" class="cards-container">
          <div v-for="item in initiativeStore.initiatives" :key="item.id" class="card">
            <div class="card-image-wrapper">
              <div v-if="item.platformId !== 1" class="source-badge external">
                🔗 {{ initiativeStore.getPlatformName(item.platformId) }}
              </div>
              <img :src="getImageUrl(item)" class="card-img" alt="Immagine iniziativa">
            </div>

            <div class="card-content">
              <div class="card-header">
                <h3>{{ item.title }}</h3>
                <div class="status-wrapper">
                  <span class="badge-status" :class="getStatusClass(item.status)">
                    {{ item.status.toUpperCase() }}
                  </span>
                  <button v-if="item.status && item.status.toLowerCase() === 'in corso'" class="follow-btn"
                    :class="{ 'active': initiativeStore.isFollowed(item.id) }" @click.prevent="handleStarClick(item)"
                    title="Segui questa iniziativa">
                    {{ initiativeStore.isFollowed(item.id) ? '⭐' : '☆' }}
                  </button>
                </div>
              </div>
              <div class="card-meta">
                <span>📍 <strong>{{ item.place || 'Trento' }}</strong></span>
                <span>🏷️ {{ initiativeStore.getCategoryName(item.categoryId) }}</span>
                <div class="date-row"><span>📅 {{ formatDate(item.creationDate) }}</span></div>
              </div>
              <div class="card-footer">
                <div class="signatures"><strong>Firme: {{ item.signatures }}</strong></div>
                <div class="actions">
                  <div v-if="item.platformId === 1" class="internal-actions">
                    <RouterLink :to="'/initiative/' + item.id"><button class="action-btn">Dettagli</button></RouterLink>
                    <button v-if="item.status === 'In corso' && userStore.canVote" @click="handleSign(item)"
                      class="sign-btn">✍️ Firma</button>
                    <span v-else-if="item.status === 'In corso' && userStore.isAuthenticated && !userStore.canVote"
                      class="no-vote-label">⛔ Solo Cittadini</span>
                  </div>
                  <a v-else :href="item.externalURL || '#'" target="_blank"><button class="external-btn">Su {{
                    initiativeStore.getPlatformName(item.platformId) }} ↗</button></a>
                </div>
              </div>
            </div>
          </div>
          <div class="pagination-controls">
            <button @click="prevPage" :disabled="initiativeStore.currentPage === 1" class="page-btn">←</button>
            <span class="page-info">Pagina {{ initiativeStore.currentPage }} di {{ initiativeStore.totalPages }}</span>
            <button @click="nextPage" :disabled="initiativeStore.currentPage >= initiativeStore.totalPages"
              class="page-btn">→</button>
          </div>
        </div>
        <div v-else class="no-results">
          <p>Nessuna iniziativa trovata.</p>
          <button @click="resetFilters" class="clear-btn">Ricarica Tutto</button>
        </div>
      </main>
    </div>

    <Transition name="slide-fade">
      <div v-if="showNotificationPrompt" class="custom-toast">
        <div class="toast-header">
          <strong>Rimani aggiornato?</strong>
          <button class="close-btn" @click="ignorePrompt">×</button>
        </div>
        <p>Vuoi ricevere notifiche sugli aggiornamenti di <strong>"{{ lastSignedInitiative?.title }}"</strong>?</p>
        <div class="toast-actions">
          <button class="btn-confirm" @click="enableNotifications">🔔 Tienimi aggiornato</button>
          <button class="btn-ignore" @click="ignorePrompt">Ignora</button>
        </div>
        <button class="btn-link" @click="disablePromptForever">Non mostrare più questo messaggio</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* COPIA GLI STILI DI PRIMA, SONO CORRETTI */
/* ... Styles ... */
.home-wrapper {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
  color: var(--text-color);
}

.app-header {
  text-align: center;
  margin-bottom: 30px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 20px;
}

.main-title {
  font-size: 3rem;
  margin: 0;
  color: var(--accent-color);
  text-transform: uppercase;
  font-weight: 800;
}

.subtitle {
  color: var(--secondary-text);
  margin-top: 5px;
}

.main-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 30px;
  align-items: start;
}

.sidebar {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  position: sticky;
  top: 100px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.reset-link {
  background: none;
  border: none;
  color: var(--secondary-text);
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
}

.filter-group {
  margin-bottom: 20px;
}

.filter-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 0.9rem;
  color: var(--text-color);
}

.filter-group input,
.filter-group select {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background-color: var(--input-bg);
  color: var(--text-color);
  box-sizing: border-box;
}

.create-btn.full-width {
  width: 100%;
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 10px;
  transition: background 0.2s;
}

.create-btn.full-width:hover {
  background: var(--accent-hover);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.count-badge {
  background: var(--card-border);
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.85rem;
  color: var(--text-color);
}

.cards-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  display: flex;
  gap: 20px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  height: 180px;
  box-shadow: var(--card-shadow);
  transition: transform 0.2s;
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.card-header h3 {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.2;
  flex: 1;
  color: var(--text-color);
  font-weight: 700;
}

.status-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-status {
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
}

.status-active {
  background-color: #3498db;
}

.status-success {
  background-color: #27ae60;
}

.status-danger {
  background-color: #e74c3c;
}

.status-muted {
  background-color: #95a5a6;
}

.status-default {
  background-color: #7f8c8d;
}

.follow-btn {
  background: transparent;
  border: none;
  font-size: 1.6rem;
  cursor: pointer;
  line-height: 1;
  transition: transform 0.2s;
  color: #ccc;
  padding: 0;
}

.follow-btn.active {
  color: #f1c40f;
  filter: drop-shadow(0 0 2px rgba(241, 196, 15, 0.5));
}

.follow-btn:hover {
  transform: scale(1.2);
  color: #f1c40f;
}

.card-meta {
  font-size: 0.9rem;
  color: var(--secondary-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 5px;
}

.date-row {
  display: flex;
  gap: 15px;
  font-size: 0.85rem;
  margin-top: 5px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.internal-actions {
  display: flex;
  gap: 10px;
}

.action-btn,
.external-btn {
  background-color: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--header-border);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  font-size: 0.9rem;
}

.action-btn:hover,
.external-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.sign-btn {
  background-color: #2c3e50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.sign-btn:hover {
  background-color: var(--accent-color);
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.source-badge.external {
  background-color: #d32f2f;
  color: white;
}

.no-vote-label {
  font-size: 0.8rem;
  color: #666;
  cursor: help;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
  align-items: center;
}

.page-btn {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-color);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-results {
  text-align: center;
  padding: 40px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--card-border);
}

.clear-btn {
  margin-top: 15px;
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.custom-toast {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 340px;
  background: var(--card-bg);
  color: var(--text-color);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color);
  padding: 20px;
  z-index: 9999;
  font-family: 'Segoe UI', sans-serif;
  animation: slideIn 0.3s ease-out;
}

.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 1.1rem;
  color: var(--accent-color);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--secondary-text);
  line-height: 1;
}

.custom-toast p {
  font-size: 0.95rem;
  color: var(--text-color);
  margin-bottom: 20px;
  line-height: 1.5;
}

.toast-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.btn-confirm {
  flex: 1;
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-confirm:hover {
  background-color: var(--accent-hover);
}

.btn-ignore {
  background: none;
  border: 1px solid var(--header-border);
  padding: 10px 15px;
  border-radius: 6px;
  color: var(--text-color);
  cursor: pointer;
}

.btn-ignore:hover {
  background-color: var(--header-border);
}

.btn-link {
  background: none;
  border: none;
  color: var(--secondary-text);
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
  width: 100%;
  text-align: center;
}

.btn-link:hover {
  color: var(--text-color);
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

@keyframes slideIn {
  from {
    transform: translateY(100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    margin-bottom: 30px;
  }

  .card {
    flex-direction: column;
    height: auto;
  }

  .card-image-wrapper {
    flex: none;
    height: 180px;
    width: 100%;
  }

  .card-content {
    padding: 15px;
  }

  .custom-toast {
    left: 20px;
    right: 20px;
    width: auto;
    bottom: 20px;
  }
}
</style>
