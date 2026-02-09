<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useToastStore } from '../stores/toastStore';
import { useImage } from '@/composables/useImage';
const { getImageUrl } = useImage();
import defaultImage from '@/assets/placeholder-initiative.jpg';

const initiativeStore = useInitiativeStore();
const toast = useToastStore();
const router = useRouter();
const API_URL = 'http://localhost:3000';

const initiatives = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
let timerInterval = null;

// --- FUNZIONI UTILI ---
const calculateTimeLeft = (expirationDate) => {
  const now = new Date();
  const target = new Date(expirationDate);
  const diff = target - now;
  if (diff <= 0) return "SCADUTA";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  let parts = [];
  if (days > 0) parts.push(`${days}g`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
};

const updateTickers = () => {
  if (!initiatives.value.length) return;
  initiatives.value.forEach(item => {
    item.displayTime = calculateTimeLeft(item.expirationDate);
    item.isUrgent = !item.displayTime.includes("g") && item.displayTime !== "SCADUTA";
  });
};

const formatDate = (date) => new Date(date).toLocaleDateString('it-IT');
const goToReply = (id) => router.push(`/admin/reply/${id}`);

// --- LOGICA PROROGA RAPIDA ---
const handleQuickExtend = (item) => {
  if (item.alreadyExtended) {
    toast.showToast("⛔ Errore: Questa iniziativa è già stata prorogata una volta.", "error");
    return;
  }

  toast.showToast(
    `Vuoi prorogare "${item.title}" di 60 giorni?`,
    'prompt',
    {
      actions: [
        {
          label: '✅ Sì, Proroga',
          style: 'primary',
          onClick: async (toastId) => {
            toast.removeToast(toastId);
            try {
              await initiativeStore.extendDeadline(item.id, item.expirationDate);
              toast.showToast("Scadenza aggiornata (+60gg)!", "success");
              // Ricarica i dati per vedere l'ordinamento aggiornato
              loadData(currentPage.value);
            } catch (err) {
              toast.showToast("Errore durante la proroga.", "error");
            }
          }
        },
        {
          label: 'Annulla',
          style: 'secondary',
          onClick: (toastId) => toast.removeToast(toastId)
        }
      ]
    }
  );
};

// --- CARICAMENTO DATI ---
const loadData = async (page = 1) => {
  const responseData = await initiativeStore.fetchExpiringInitiatives(page);

  if (responseData && responseData.data) {
    initiatives.value = responseData.data.map(init => ({
      ...init,
      displayTime: calculateTimeLeft(init.expirationDate),
      isUrgent: false,
      alreadyExtended: false // Se il backend non fornisce questo dato
    }));

    if (responseData.meta) {
      currentPage.value = responseData.meta.currentPage;
      totalPages.value = responseData.meta.totalPages;
    }
    updateTickers();
  } else {
    initiatives.value = []; // Pulisci in caso di errore
  }
};

const changePage = (delta) => {
  const newPage = currentPage.value + delta;
  if (newPage >= 1 && newPage <= totalPages.value) {
    loadData(newPage);
  }
};

onMounted(() => {
  loadData(1); // Carica la prima pagina
  timerInterval = setInterval(updateTickers, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});
</script>

<template>
  <div class="admin-wrapper">
    <div class="header-section">
      <h1 class="page-title">⏳ Monitoraggio Scadenze</h1>
      <p class="subtitle">Iniziative interne in scadenza in ordine di data</p>
    </div>

    <div v-if="initiatives.length > 0" class="initiatives-list">
      <div v-for="item in initiatives" :key="item.id" class="card">

        <div class="card-image-wrapper">
          <img :src="getImageUrl(item)" class="card-img" alt="Immagine">
        </div>

        <div class="card-content">
          <div class="card-header">
            <h3>{{ item.title }}</h3>
            <div class="timer-badge" :class="{ 'urgent': item.isUrgent, 'expired': item.displayTime === 'SCADUTA' }">
              ⏱️ {{ item.displayTime }}
            </div>
          </div>

          <div class="card-meta">
            <span>📍 {{ item.place || 'Trento' }}</span>
            <span>📅 Scadenza: {{ formatDate(item.expirationDate) }}</span>
            <span v-if="item.alreadyExtended" class="extended-label">✔️ Proroga attivata</span>
          </div>

          <div class="card-footer">
            <div class="signatures"><strong>🔥 {{ item.signatures }} Firme</strong></div>

            <div class="actions-group">
              <button class="action-btn extend" :class="{ 'disabled': item.alreadyExtended }"
                @click="handleQuickExtend(item)" title="Estendi scadenza di 60 giorni">
                ⏳ +60gg
              </button>

              <button class="action-btn reply" @click="goToReply(item.id)">
                📝 Vedi e Rispondi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-results">
      <p>Nessuna iniziativa in scadenza trovata.</p>
    </div>

    <div v-if="totalPages > 1" class="pagination-controls">
      <button :disabled="currentPage === 1" @click="changePage(-1)" class="page-btn">←</button>
      <span>Pagina {{ currentPage }} di {{ totalPages }}</span>
      <button :disabled="currentPage === totalPages" @click="changePage(1)" class="page-btn">→</button>
    </div>
  </div>
</template>

<style scoped>
/* GENERALI */
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

/* LISTA E CARD */
.initiatives-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.card {
  display: flex;
  gap: 20px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  height: 180px;
  box-shadow: var(--card-shadow);
  transition: transform 0.2s;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.card-image-wrapper {
  flex: 0 0 220px;
  position: relative;
  background: #333;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-content {
  flex: 1;
  padding: 15px 20px;
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

/* TIMER */
.timer-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #f39c12;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  min-width: 110px;
  text-align: center;
}

.timer-badge.urgent {
  background-color: #e74c3c;
  animation: pulse 1s infinite alternate;
}

.timer-badge.expired {
  background-color: #34495e;
  animation: none;
}

@keyframes pulse {
  to {
    transform: scale(1.05);
  }
}

.card-meta {
  font-size: 0.9rem;
  color: var(--secondary-text);
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 5px;
}

.extended-label {
  color: #27ae60;
  font-weight: bold;
  font-size: 0.8rem;
}

/* FOOTER E BOTTONI */
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

.actions-group {
  display: flex;
  gap: 10px;
}

.action-btn {
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  transition: all 0.2s;
  color: white;
}

/* Bottone Rispondi (Verde) */
.action-btn.reply {
  background-color: var(--accent-color);
}

.action-btn.reply:hover {
  opacity: 0.9;
}

/* Bottone Proroga (Arancione) */
.action-btn.extend {
  background-color: #f39c12;
}

.action-btn.extend:hover {
  background-color: #e67e22;
}

/* Stato Disabilitato (Grigio) per Proroga */
.action-btn.extend.disabled {
  background-color: #95a5a6;
  /* Grigio */
  cursor: not-allowed;
  opacity: 0.7;
}

/* Al click sul disabilitato gestiamo il toast, quindi non mettiamo pointer-events: none */

.no-results {
  text-align: center;
  padding: 40px;
  color: var(--secondary-text);
  font-size: 1.1rem;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 30px;
  align-items: center;
}

.page-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-color);
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

@media (max-width: 768px) {
  .card {
    flex-direction: column;
    height: auto;
  }

  .card-image-wrapper {
    height: 160px;
  }

  .card-content {
    padding: 15px;
  }

  .card-header {
    padding-right: 0;
    margin-bottom: 35px;
  }

  .timer-badge {
    top: 35px;
    left: 0;
    right: auto;
  }

  .card-footer {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .actions-group {
    width: 100%;
  }

  .action-btn {
    flex: 1;
  }
}
</style>
