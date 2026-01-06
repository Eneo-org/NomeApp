<script setup>
import { ref, onMounted } from 'vue';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useRouter } from 'vue-router';

const store = useInitiativeStore();
const router = useRouter();
const pendingInitiatives = ref([]);
const loading = ref(false);

// Formatta la data in modo leggibile
const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  return new Date(dateString).toLocaleDateString('it-IT');
};

// Carica solo le iniziative con stato "In attesa"
const loadPending = async () => {
  loading.value = true;
  try {
    // Nota: Questa chiamata funzionerà se nel backend hai abilitato il filtro per 'status'
    // Se non trova nulla, la lista rimarrà vuota (corretto per ora)
    await store.fetchInitiatives(1, 'date', { status: 'In attesa' });
    pendingInitiatives.value = store.initiatives;
  } finally {
    loading.value = false;
  }
};

// Gestisce l'approvazione o il rifiuto
const handleDecision = async (id, decision) => {
  const confirmMsg = decision === 'Approvata'
    ? "Sei sicuro di voler approvare questa iniziativa?"
    : "Sei sicuro di voler respingere questa iniziativa?";

  if (!confirm(confirmMsg)) return;

  // Chiama l'azione dello store per aggiornare lo stato
  // Assicurati di aver aggiunto 'updateStatus' nello store come avevamo discusso
  const success = await store.updateStatus(id, decision);

  if (success) {
    // Rimuovi l'iniziativa dalla lista locale per farla sparire subito
    pendingInitiatives.value = pendingInitiatives.value.filter(i => i.id !== id);
    alert(`Iniziativa ${decision.toLowerCase()} con successo!`);
  }
};

onMounted(() => {
  loadPending();
});
</script>

<template>
  <div class="admin-container">
    <div class="header">
      <h1>🛡️ Moderazione Iniziative</h1>
      <p>Gestisci le proposte in attesa di approvazione.</p>
    </div>

    <div v-if="loading" class="loading">Caricamento in corso...</div>

    <div v-else-if="pendingInitiatives.length === 0" class="empty-state">
      <p>✅ Nessuna iniziativa in attesa di approvazione.</p>
      <button @click="router.push('/admin/dashboard')" class="back-btn">Torna alla Dashboard</button>
    </div>

    <div v-else class="list-container">
      <div v-for="item in pendingInitiatives" :key="item.id" class="mod-card">
        <div class="card-content">
          <span class="badge-pending">In attesa</span>
          <h3>{{ item.title }}</h3>
          <p class="desc">{{ item.description ? item.description.substring(0, 150) + '...' : '' }}</p>
          <div class="meta">
            <span>👤 Autore ID: {{ item.authorId }}</span>
            <span>📅 {{ formatDate(item.creationDate) }}</span>
            <span>🏷️ Categoria: {{ store.getCategoryName(item.categoryId) }}</span>
          </div>
        </div>

        <div class="card-actions">
          <RouterLink :to="'/initiative/' + item.id" target="_blank" class="preview-link">
            👁️ Vedi Dettagli
          </RouterLink>
          <div class="buttons">
            <button @click="handleDecision(item.id, 'Respinta')" class="reject-btn">🚫 Respingi</button>
            <button @click="handleDecision(item.id, 'Approvata')" class="approve-btn">✅ Approva</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 30px 20px;
  color: var(--text-color);
}

.header {
  margin-bottom: 30px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 15px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px dashed var(--card-border);
  color: var(--secondary-text);
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mod-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  box-shadow: var(--card-shadow);
}

.card-content {
  flex: 1;
}

.badge-pending {
  background: #f39c12;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: bold;
}

.mod-card h3 {
  margin: 10px 0;
  font-size: 1.2rem;
  color: var(--text-color);
}

.desc {
  color: var(--secondary-text);
  font-size: 0.95rem;
  margin-bottom: 15px;
}

.meta {
  display: flex;
  gap: 15px;
  font-size: 0.85rem;
  color: #888;
}

.card-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 15px;
  min-width: 150px;
}

.preview-link {
  text-align: center;
  color: var(--accent-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.preview-link:hover {
  text-decoration: underline;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.approve-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.reject-btn {
  background: #c0392b;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.back-btn {
  margin-top: 15px;
  padding: 10px 20px;
  cursor: pointer;
  background-color: var(--card-border);
  border: none;
  color: var(--text-color);
  border-radius: 6px;
}

@media (max-width: 768px) {
  .mod-card {
    flex-direction: column;
  }

  .card-actions {
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>
