<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../stores/userStore';

const userStore = useUserStore();
const admins = ref([]);
const meta = ref({});
const searchFiscal = ref('');
const loading = ref(false);

const loadAdmins = async (page = 1) => {
  loading.value = true;
  const result = await userStore.fetchAdminUsers(page, searchFiscal.value);
  if (result) {
    admins.value = result.data;
    meta.value = result.meta;
  }
  loading.value = false;
};

// Cerca quando si preme Invio o il bottone
const handleSearch = () => {
  loadAdmins(1);
};

onMounted(() => loadAdmins());
</script>

<template>
  <div class="admin-container">
    <div class="header">
      <h1>👥 Gestione Amministratori</h1>
      <p>Lista del personale amministrativo del Comune.</p>
    </div>

    <div class="search-bar">
      <input v-model="searchFiscal" type="text" placeholder="Cerca per Codice Fiscale..." @keyup.enter="handleSearch" />
      <button @click="handleSearch">Cerca</button>
    </div>

    <div v-if="loading" class="loading">Caricamento...</div>

    <table v-else class="admin-table">
      <thead>
        <tr>
          <th>Cognome e Nome</th>
          <th>Codice Fiscale</th>
          <th>Email</th>
          <th>Ruolo</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in admins" :key="user.id" class="admin-row">
          <td>{{ user.lastName }} {{ user.firstName }}</td>
          <td>{{ user.fiscalCode }}</td>
          <td>{{ user.email }}</td>
          <td><span class="badge-admin">ADMIN</span></td>
        </tr>
        <tr v-if="admins.length === 0">
          <td colspan="4" class="no-data">Nessun amministratore trovato.</td>
        </tr>
      </tbody>
    </table>

    <div class="pagination" v-if="meta.totalPages > 1">
      <button :disabled="meta.currentPage === 1" @click="loadAdmins(meta.currentPage - 1)">Indietro</button>
      <span>Pagina {{ meta.currentPage }} di {{ meta.totalPages }}</span>
      <button :disabled="meta.currentPage >= meta.totalPages" @click="loadAdmins(meta.currentPage + 1)">Avanti</button>
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
  margin-bottom: 20px;
  border-bottom: 1px solid var(--header-border);
  padding-bottom: 10px;
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
  background: var(--accent-color);
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

.badge-admin {
  background: #e74c3c;
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.admin-row:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.no-data {
  text-align: center;
  color: var(--secondary-text);
  padding: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
  align-items: center;
}
</style>
