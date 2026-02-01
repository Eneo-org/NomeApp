<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/userStore';

const userStore = useUserStore();
const admins = ref([]);
const meta = ref({});
const searchFiscal = ref('');
const loading = ref(false);

// --- STATO MODALE ---
const showModal = ref(false);
const candidateFiscal = ref('');
const candidateResult = ref(null);
const searchPerformed = ref(false);
const processing = ref(false);

// 1. CARICAMENTO DATI
const loadAdmins = async (page = 1) => {
  loading.value = true;
  const result = await userStore.fetchAdminUsers(page, searchFiscal.value);
  if (result) {
    admins.value = result.data;
    meta.value = result.meta;
  }
  loading.value = false;
};

// 2. ORDINAMENTO INTELLIGENTE
// Requisito: Alfabetico, ma l'utente corrente è sempre primo
const sortedAdmins = computed(() => {
  if (!admins.value) return [];

  // Creiamo una copia per non mutare l'originale
  let list = [...admins.value];

  // Ordina A-Z per cognome
  list.sort((a, b) => {
    const nameA = a.lastName || 'ZZZ'; // Fallback per utenti pre-autorizzati senza nome
    const nameB = b.lastName || 'ZZZ';
    return nameA.localeCompare(nameB);
  });

  // Trova l'utente corrente e spostalo in cima
  const myIndex = list.findIndex(u => u.id === userStore.user?.id);
  if (myIndex > -1) {
    const me = list.splice(myIndex, 1)[0];
    list.unshift(me);
  }

  return list;
});

const handleSearch = () => {
  loadAdmins(1);
};

// 3. AZIONE REVOCA RUOLO
const handleRevoke = async (user) => {
  if (!confirm(`Vuoi davvero togliere il ruolo di admin a ${user.firstName || 'questo utente'}?`)) return;

  loading.value = true;
  const success = await userStore.revokeAdminRole(user.id);
  // Ricarichiamo la lista per vedere le modifiche
  if (success) await loadAdmins(meta.value.currentPage);
  loading.value = false;
};

// --- LOGICA MODALE ---
const openAddModal = () => {
  showModal.value = true;
  candidateFiscal.value = '';
  candidateResult.value = null;
  searchPerformed.value = false;
};

const closeModal = () => {
  showModal.value = false;
};

const searchCandidate = async () => {
  if (!candidateFiscal.value) return;
  
  // Assicuriamo che il CF sia maiuscolo per coerenza
  candidateFiscal.value = candidateFiscal.value.toUpperCase();

  processing.value = true;
  searchPerformed.value = false;

  const result = await userStore.findUserByFiscalCode(candidateFiscal.value);
  candidateResult.value = result;

  searchPerformed.value = true;
  processing.value = false;
};

const promoteUser = async () => {
  processing.value = true;
  const success = await userStore.promoteToAdmin(candidateResult.value.id);
  processing.value = false;

  if (success) {
    closeModal();
    loadAdmins(1);
  }
};

const preAuthorize = async () => {
  processing.value = true;
  // candidateFiscal è già stato reso maiuscolo in searchCandidate
  const success = await userStore.preAuthorizeAdmin(candidateFiscal.value);
  processing.value = false;

  if (success) {
    closeModal();
    loadAdmins(1);
  }
};

onMounted(() => loadAdmins());
</script>

<template>
  <div class="admin-container">
    <div class="header-row">
      <div class="header-text">
        <h1>👥 Gestione Amministratori</h1>
        <p>Gestisci i permessi e aggiungi nuovi amministratori.</p>
      </div>
      <button class="add-btn" @click="openAddModal" title="Aggiungi Admin">+</button>
    </div>

    <div class="search-bar">
      <input v-model="searchFiscal" type="text" placeholder="Filtra lista per Codice Fiscale..."
        @keyup.enter="handleSearch" />
      <button @click="handleSearch">Filtra</button>
    </div>

    <div v-if="loading" class="loading">Caricamento...</div>

    <table v-else class="admin-table">
      <thead>
        <tr>
          <th>Cognome e Nome</th>
          <th>Codice Fiscale</th>
          <th>Email</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in sortedAdmins" :key="user.id" class="admin-row"
          :class="{ 'is-me': user.id === userStore.user?.id }">
          <td>
            <span v-if="user.lastName">{{ user.lastName }} {{ user.firstName }}</span>
            <span v-else class="waiting-text">(In attesa di registrazione)</span>
            <span v-if="user.id === userStore.user?.id" class="me-tag">(Tu)</span>
          </td>
          <td>{{ user.fiscalCode }}</td>
          <td>{{ user.email || '-' }}</td>
          <td>
            <button v-if="user.id !== userStore.user?.id" class="revoke-btn" @click="handleRevoke(user)">
              Rimuovi
            </button>
          </td>
        </tr>
        <tr v-if="sortedAdmins.length === 0">
          <td colspan="4" class="no-data">Nessun amministratore trovato.</td>
        </tr>
      </tbody>
    </table>

    <div class="pagination" v-if="meta.totalPages > 1">
      <button :disabled="meta.currentPage === 1" @click="loadAdmins(meta.currentPage - 1)">Indietro</button>
      <span>Pagina {{ meta.currentPage }} di {{ meta.totalPages }}</span>
      <button :disabled="meta.currentPage >= meta.totalPages" @click="loadAdmins(meta.currentPage + 1)">Avanti</button>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Aggiungi Amministratore</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <p>Cerca un cittadino per CF per promuoverlo.</p>
          <div class="modal-search">
            <input v-model="candidateFiscal" type="text" placeholder="Codice Fiscale..."
              style="text-transform: uppercase;" @input="candidateFiscal = $event.target.value.toUpperCase()">
            <button @click="searchCandidate" :disabled="processing || !candidateFiscal">🔍 Cerca</button>
          </div>

          <div v-if="candidateResult" class="result-box found">
            <p>✅ <strong>Utente Trovato</strong></p>
            <p>{{ candidateResult.firstName }} {{ candidateResult.lastName }}</p>
            <p class="small">{{ candidateResult.email }}</p>
            <button class="action-btn promote" @click="promoteUser" :disabled="processing">
              Conferma Promozione
            </button>
          </div>

          <div v-else-if="searchPerformed && !candidateResult" class="result-box not-found">
            <p>⚠️ <strong>Nessun utente trovato</strong></p>
            <p class="small">Nessun cittadino registrato con questo CF.</p>
            <p>Vuoi <strong>pre-autorizzare</strong> questo codice fiscale?</p>
            <p class="info-text">Creerà un utente amministratore "vuoto" (IS_CITTADINO=0).</p>
            <button class="action-btn preauth" @click="preAuthorize" :disabled="processing">
              Sì, Pre-Autorizza
            </button>
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

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 10px;
}

.add-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.add-btn:hover {
  transform: scale(1.1);
}

.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-bar input {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
}

.search-bar button {
  padding: 10px 20px;
  background: var(--secondary-text);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-bg);
  border-radius: 8px;
  overflow: hidden;
}

.admin-table th,
.admin-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid var(--card-border);
}

.admin-table th {
  background-color: rgba(0, 0, 0, 0.05);
  font-weight: bold;
}

.is-me {
  background-color: rgba(66, 184, 131, 0.1);
}

.me-tag {
  font-size: 0.75rem;
  color: var(--accent-color);
  font-weight: bold;
  margin-left: 5px;
}

.waiting-text {
  font-style: italic;
  color: var(--secondary-text);
}

.revoke-btn {
  background: transparent;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.revoke-btn:hover {
  background: #e74c3c;
  color: white;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
  align-items: center;
}

/* Modale */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg);
  padding: 25px;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  color: var(--text-color);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-color);
}

.modal-search {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.modal-search input {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
}

.result-box {
  padding: 15px;
  border-radius: 8px;
  margin-top: 10px;
}

.result-box.found {
  background: rgba(39, 174, 96, 0.1);
  border: 1px solid #27ae60;
}

.result-box.not-found {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid #e74c3c;
}

.action-btn {
  margin-top: 10px;
  padding: 10px 15px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  width: 100%;
  font-weight: bold;
}

.action-btn.promote {
  background: #27ae60;
}

.action-btn.preauth {
  background: #e67e22;
}

.small {
  font-size: 0.85rem;
  color: var(--secondary-text);
}

.info-text {
  font-size: 0.8rem;
  font-style: italic;
  margin-top: 5px;
}
</style>
