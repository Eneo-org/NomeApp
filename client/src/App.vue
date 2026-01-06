<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import TheToast from './components/TheToast.vue'

// 1. IMPORTA IL COMPOSABLE DEL TEMA
import { useTheme } from '@/composables/useTheme';

const router = useRouter()
const userStore = useUserStore()

// 2. ESTRAI LE VARIABILI E FUNZIONI DAL COMPOSABLE
const { isDark, toggleTheme, initTheme } = useTheme();

// --- INITIALIZZAZIONE APP ---
onMounted(() => {
  // 3. Inizializza il tema usando la funzione centralizzata
  initTheme();

  // Ripristina la Sessione Utente
  userStore.initializeStore()
})
// ------------------------

const logout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout">

    <TheToast />

    <nav class="navbar">
      <div class="nav-left">
        <RouterLink to="/" class="nav-logo">Trento Partecipa</RouterLink>
      </div>

      <div class="nav-right">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/archive">Archivio</RouterLink>

        <RouterLink v-if="userStore.isAuthenticated" to="/dashboard">
          📊 Dashboard
        </RouterLink>

        <RouterLink v-if="userStore.isAuthenticated && userStore.user?.isAdmin" to="/admin/dashboard"
          class="admin-link">
          🏛️ Area Admin
        </RouterLink>

        <RouterLink v-if="!userStore.isAuthenticated" to="/login">Accedi</RouterLink>

        <div v-else class="user-menu">
          <span class="user-name-text">{{ userStore.fullName }}</span>
          <a @click.prevent="logout" href="#" class="logout-link">Esci</a>
        </div>

        <button @click="toggleTheme" class="theme-btn" title="Cambia tema">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>
    </nav>

    <main class="main-content">
      <RouterView />
    </main>

    <footer class="app-footer">
      <p>&copy; 2025 Trento Partecipa - Piattaforma di Cittadinanza Attiva</p>
    </footer>

  </div>
</template>

<style>
/* --- DEFINIZIONE VARIABILI GLOBALI (Light Mode Default) --- */
:root {
  --bg-color: #f8f9fa;
  --text-color: #212529;
  --secondary-text: #6c757d;
  --card-bg: #ffffff;
  --card-border: #dee2e6;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  --header-border: #e9ecef;
  --input-bg: #ffffff;
  --accent-color: #42b883;
  --accent-hover: #3aa876;
}

/* --- VARIABILI DARK MODE --- */
/* Importante: deve corrispondere alla classe usata in useTheme.js (qui è 'dark') */
/* Se nel tuo useTheme hai usato .add('dark'), allora qui deve essere body.dark o html.dark */
/* Se hai usato .add('dark-mode'), mantieni body.dark-mode */

/* Per sicurezza, supportiamo entrambe le classi */
body.dark-mode,
body.dark {
  --bg-color: #161616;
  --text-color: #e0e0e0;
  --secondary-text: #a0a0a0;
  --card-bg: #202020;
  --card-border: #2a2a2a;
  --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  --header-border: #2a2a2a;
  --input-bg: #252525;
}

/* APPLICAZIONE VARIABILI AL BODY */
body {
  margin: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s, color 0.3s;
}

/* STILI LAYOUT APP */
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Navbar */
.navbar {
  background-color: var(--card-bg);
  border-bottom: 1px solid var(--header-border);
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-logo {
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--accent-color);
  text-decoration: none;
  text-transform: uppercase;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-right a {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: color 0.2s;
}

.nav-right a:hover {
  color: var(--accent-color);
}

/* Stile speciale per il link Admin */
.admin-link {
  color: #27ae60 !important;
  font-weight: bold !important;
  border: 1px solid #27ae60;
  padding: 5px 10px;
  border-radius: 4px;
}

.admin-link:hover {
  background-color: #27ae60;
  color: white !important;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 15px;
}

/* Nuovo stile per il testo del nome utente (non cliccabile) */
.user-name-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: var(--accent-color);
  border-right: 1px solid var(--secondary-text);
  padding-right: 15px;
  cursor: default;
}

.logout-link {
  cursor: pointer;
  color: #e74c3c !important;
}

/* Pulsante Tema */
.theme-btn {
  background: none;
  border: 1px solid var(--card-border);
  border-radius: 50%;
  width: 35px;
  height: 35px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: background 0.2s;
  color: var(--text-color);
}

.theme-btn:hover {
  background-color: var(--header-border);
}

/* Contenuto */
.main-content {
  flex: 1;
  padding: 20px;
}

/* Footer */
.app-footer {
  text-align: center;
  padding: 20px;
  color: var(--secondary-text);
  font-size: 0.9rem;
  border-top: 1px solid var(--header-border);
  margin-top: 40px;
}

/* Stile per il link attivo */
.nav-right a.router-link-active {
  color: var(--accent-color);
  font-weight: bold;
  border-bottom: 2px solid var(--accent-color);
}

/* Evitiamo la sottolineatura sul bottone admin quando attivo */
.nav-right a.router-link-active.admin-link {
  border-bottom: 1px solid #27ae60;
  background-color: #27ae60;
  color: white !important;
}
</style>
