<script setup>
import { useUserStore } from '../stores/userStore';
const userStore = useUserStore();
</script>

<template>
  <div class="admin-home">
    <div class="header">
      <h1>🏛️ Pannello di Controllo Amministrazione</h1>
      <p>Bentornato, {{ userStore.user?.firstName }}. Cosa vuoi fare oggi?</p>
    </div>

    <div class="dashboard-grid">

      <RouterLink to="/admin/moderation" class="dash-card blue">
        <div class="icon">🛡️</div>
        <h3>Moderazione Iniziative</h3>
        <p>Approva o respingi le nuove proposte dei cittadini.</p>
      </RouterLink>

      <RouterLink to="/admin/expiring" class="dash-card red">
        <div class="icon">⏳</div>
        <h3>Monitoraggio Scadenze</h3>
        <p>Controlla le iniziative urgenti che richiedono una risposta.</p>
      </RouterLink>

      <RouterLink to="/admin/create-budget" class="dash-card green">
        <div class="icon">💰</div>
        <h3>Crea Bilancio</h3>
        <p>Lancia una nuova votazione per il bilancio partecipativo.</p>
      </RouterLink>

      <RouterLink to="/admin/users" class="dash-card purple">
        <div class="icon">👥</div>
        <h3>Gestione Personale</h3>
        <p>Visualizza la lista degli amministratori e utenti.</p>
      </RouterLink>

    </div>
  </div>
</template>

<style scoped>
.admin-home {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
}

.header {
  text-align: center;
  margin-bottom: 50px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  color: var(--accent-color);
}

.header p {
  color: var(--secondary-text);
  font-size: 1.1rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}

.dash-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 30px;
  text-decoration: none;
  color: var(--text-color);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: var(--card-shadow);
}

.dash-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
}

.icon {
  font-size: 3rem;
  margin-bottom: 20px;
}

.dash-card h3 {
  margin: 0 0 10px 0;
  font-size: 1.4rem;
}

.dash-card p {
  color: var(--secondary-text);
  margin: 0;
}

/* Bordi colorati per distinguere le sezioni */
.dash-card.blue:hover {
  border-color: #3498db;
}

.dash-card.red:hover {
  border-color: #e74c3c;
}

.dash-card.green:hover {
  border-color: #27ae60;
}

.dash-card.purple:hover {
  border-color: #9b59b6;
}
</style>
