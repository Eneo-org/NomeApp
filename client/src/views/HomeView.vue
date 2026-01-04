<script setup>
import { ref, onMounted, watch } from 'vue'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useParticipatoryBudgetStore } from '../stores/participatoryBudgetStore'
import { useUserStore } from '../stores/userStore'

// 1. IMPORTA L'IMMAGINE DI DEFAULT (Assicurati che il file esista in src/assets/)
import defaultImage from '@/assets/placeholder-initiative.jpg'; 



const API_URL = 'http://localhost:3000'; // URL del tuo Backend

const initiativeStore = useInitiativeStore()
const budgetStore = useParticipatoryBudgetStore()
const userStore = useUserStore()
const page = ref(1);
const sort = ref('signatures');

// --- STATO FILTRI ---
const filters = ref({
  search: '',
  category: '',
  platform: '',
  status: 'In corso' //filtro di default
});

// Helper date
const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}

// --- LOGICA DI CARICAMENTO ---
onMounted(async () => {
  // 1. Carichiamo le opzioni per le select (Categorie e Piattaforme)
  await initiativeStore.fetchFiltersData()

  // 2. Carichiamo le iniziative (Pagina 1, Default Ordinamento)
  loadData()

  // 3. Carichiamo il bilancio
  budgetStore.fetchActiveBudget()
})

// Funzione centrale per caricare i dati
const loadData = async () => {
  // Passiamo filters.value che ora contiene { status: 'In corso' }
  await initiativeStore.fetchInitiatives(page.value, sort.value, filters.value);
};

// --- NUOVA FUNZIONE PER GESTIRE LE IMMAGINI ---
const getImageUrl = (item) => {
  // Caso 1: Nessun allegato -> Ritorna immagine default locale
  if (!item.attachment || !item.attachment.filePath) {
    return defaultImage;
  }

  // Caso 2: Allegato presente -> Costruisci URL Backend
  // Nota: .replace(/\\/g, '/') serve per fixare i percorsi Windows (es. uploads\file.jpg -> uploads/file.jpg)
  const cleanPath = item.attachment.filePath.replace(/\\/g, '/');
  return `${API_URL}/${cleanPath}`;
};

// --- GESTIONE PAGINAZIONE ---
const nextPage = () => {
  if (initiativeStore.currentPage < initiativeStore.totalPages) {
    initiativeStore.currentPage++ // Incrementiamo localmente prima di chiamare
    loadData()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const prevPage = () => {
  if (initiativeStore.currentPage > 1) {
    initiativeStore.currentPage-- // Decrementiamo localmente
    loadData()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// --- GESTIONE FILTRI ---

// Applichiamo i filtri quando l'utente preme invio o cambia una select
const applyFilters = () => {
  initiativeStore.currentPage = 1 // Si riparte sempre dalla prima pagina quando si filtra
  loadData()
}

// Reset filtri
const resetFilters = () => {
  filters.value = { search: '', place: '', category: '', platform: '' }
  applyFilters()
}

const handleSign = async (item) => {
  // 1. Controllo Login
  if (!userStore.isAuthenticated) {
    // Se non è loggato, lo mandiamo alla pagina di login
    if (confirm("Devi accedere per firmare. Vuoi andare al login?")) {
      // Nota: assicurati di aver importato useRouter se non c'è
      // import { useRouter } from 'vue-router'; const router = useRouter();
      // Ma qui possiamo usare window.location o router.push se già definito
      window.location.href = '/login';
    }
    return;
  }

  // 2. Chiamata allo Store
  const result = await initiativeStore.signInitiative(item.id);

  // 3. Feedback visivo (Opzionale, l'alert è già nello store)
  if (result.success) {
    // Possiamo fare un effetto sonoro o un toast notification qui in futuro
    console.log("Firma registrata con successo!");
  }
};

const getStatusClass = (status) => {
  if (!status) return 'status-default';

  // Normalizziamo il testo (minuscolo) per evitare errori
  const s = status.toLowerCase();

  if (s === 'in corso') return 'status-active';
  if (s === 'approvata') return 'status-success';
  if (s === 'respinta') return 'status-danger';
  if (s === 'scaduta') return 'status-muted';

  return 'status-default';
};

// Opzionale: Se vuoi che il filtro "Luogo" o "Cerca" parta solo premendo Invio, togli il watch.
// Se vuoi che sia istantaneo sulle select, usa watch.
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
          <input v-model="filters.search" type="text" placeholder="Parole chiave...">
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

        <div v-if="budgetStore.activeBudget" class="budget-banner">
          <div class="budget-header">
            <div>
              <span class="pinned-badge">📌 IN PRIMO PIANO</span>
              <h2>{{ budgetStore.activeBudget.title }}</h2>
              <p class="budget-meta">Scadenza: {{ formatDate(budgetStore.activeBudget.expirationDate) }}</p>
            </div>
          </div>

          <div class="budget-options">
            <p>Scegli il progetto che vorresti vedere realizzato:</p>
            <div class="options-grid">
              <div v-for="option in budgetStore.activeBudget.options" :key="option.id" class="option-card"
                :class="{ 'voted': budgetStore.activeBudget.votedOptionId === option.position }"
                @click="budgetStore.voteBudgetOption(option.position)">

                <span class="option-text">{{ option.text }}</span>

                <span v-if="budgetStore.activeBudget.votedOptionId === option.position" class="vote-check">✅</span>
                <span v-else class="vote-action">Vota</span>
              </div>
            </div>
          </div>
        </div>

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
                    :class="{ 'active': initiativeStore.isFollowed(item.id) }" title="Segui/Smetti di seguire"
                    @click.prevent="initiativeStore.toggleFollow(item.id, item.title)">
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
                <div class="signatures">
                  <strong>Firme: {{ item.signatures }}</strong>
                </div>

                <div class="actions">
                  <div v-if="item.platformId === 1" class="internal-actions">
                    <RouterLink :to="'/initiative/' + item.id">
                      <button class="action-btn">Dettagli</button>
                    </RouterLink>

                    <button v-if="item.status === 'In corso'" @click="handleSign(item)" class="sign-btn">
                      ✍️ Firma
                    </button>
                  </div>

                  <a v-else :href="item.externalURL || '#'" target="_blank" class="external-link-btn">
                    <button class="action-btn outline">
                      Su {{ initiativeStore.getPlatformName(item.platformId) }} ↗
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="pagination-controls">
            <button @click="prevPage" :disabled="initiativeStore.currentPage === 1" class="page-btn">
              ←
            </button>

            <span class="page-info">Pagina {{ initiativeStore.currentPage }} di {{ initiativeStore.totalPages }}</span>

            <button @click="nextPage" :disabled="initiativeStore.currentPage >= initiativeStore.totalPages"
              class="page-btn">
              →
            </button>
          </div>

        </div>

        <div v-else class="no-results">
          <p>Nessuna iniziativa trovata.</p>
          <button @click="resetFilters" class="clear-btn">Ricarica Tutto</button>
        </div>

      </main>
    </div>
  </div>
</template>

<style scoped>
/* COPIA QUI I TUOI STILI CSS (GIA' PRESENTI NEL FILE PRECEDENTE) */
/* Ho mantenuto le classi uguali, quindi il CSS funzionerà perfettamente */

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

/* Sidebar */
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
}

/* Content */
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

/* Cards */
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
}

.status-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: bold;
  background: #1565c0;
  color: white;
  white-space: nowrap;
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

.detail-btn {
  background-color: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--header-border);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.detail-btn:hover {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

/* External Badges */
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

.external-btn {
  text-decoration: none;
  font-size: 0.9rem;
  display: inline-block;
  text-align: center;
  background-color: transparent;
  border: 1px solid var(--secondary-text);
  color: var(--text-color);
  padding: 6px 12px;
  border-radius: 4px;
}

.external-btn:hover {
  background-color: var(--card-border);
  border-color: var(--text-color);
}

/* Pagination */
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

/* --- STILI BUDGET --- */
.budget-banner {
  background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
  border: 1px solid #ffd700;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 40px;
  color: white;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.15);
}

.budget-header {
  margin-bottom: 20px;
}

.pinned-badge {
  background-color: #ffd700;
  color: #1a252f;
  font-weight: bold;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  display: inline-block;
  margin-bottom: 10px;
}

.budget-header h2 {
  margin: 0 0 5px 0;
  font-size: 1.8rem;
  color: #fff;
}

.budget-meta {
  color: #ccc;
  margin: 0;
  font-size: 0.9rem;
}

.budget-options p {
  margin-bottom: 15px;
  color: #e0e0e0;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.option-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.option-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.option-card.voted {
  background: rgba(66, 184, 131, 0.2);
  border-color: #42b883;
}

.option-text {
  font-weight: 500;
  font-size: 1.1rem;
}

.vote-action {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #ffd700;
  font-weight: bold;
}

.vote-check {
  font-size: 1.5rem;
}

.no-results {
  text-align: center;
  padding: 40px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--card-border);
}

.internal-actions {
  display: flex;
  gap: 10px;
}

.sign-btn {
  background-color: #2c3e50;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.sign-btn:hover {
  background-color: var(--accent-color);
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

.status-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.follow-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: transform 0.2s, filter 0.2s;
  filter: grayscale(100%);
  opacity: 0.7;
}

.follow-btn:hover {
  transform: scale(1.2);
  filter: grayscale(0%);
  opacity: 1;
}

.follow-btn {
  background: transparent;
  border: none;
  font-size: 1.6rem;
  cursor: pointer;
  line-height: 1;
  transition: transform 0.2s;
  color: #ccc;
}

.follow-btn.active {
  color: #f1c40f;
  filter: drop-shadow(0 0 2px rgba(241, 196, 15, 0.5));
}

.follow-btn:hover {
  transform: scale(1.2);
  color: #f1c40f;
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
    height: 160px;
    width: 100%;
  }

  .card-content {
    padding: 15px;
  }
}
</style>
