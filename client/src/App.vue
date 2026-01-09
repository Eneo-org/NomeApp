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
/* --- DEFINIZIONE VARIABILI GLOBALI (Light Mode - MODIFICATA) --- */
:root {
  /* 1. SFONDO GENERALE (Grigio Solido) */
  --bg-color: #E2E8F0;

  --text-color: #1e293b;
  --secondary-text: #64748b;

  /* 2. CARD (Bianche con bordi e ombre definite) */
  --card-bg: #ffffff;
  --card-border: #94A3B8;
  --card-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

  /* 3. NAVBAR LIGHT MODE (Modificata come richiesto) */
  /* Colore scuro/grigio per la barra in Light Mode */
  --navbar-bg: #DEE2E6;
  /* Ombra forte per staccarla */
  --navbar-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --header-border: #cbd5e1;

  /* INPUTS */
  --input-bg: #ffffff;
  --input-border: #94A3B8;

  /* BRAND COLORS */
  --accent-color: #42b883;
  --accent-hover: #3aa876;
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;

  /* OTP */
  --otp-bg: #F1F5F9;
  --otp-border: #64748b;
}

/* --- VARIABILI DARK MODE (INVARIATA - ORIGINALE) --- */
body.dark-mode,
body.dark {
  /* Copia esatta dei tuoi valori originali */
  --bg-color: #161616;
  --text-color: #e0e0e0;
  --secondary-text: #a0a0a0;

  --card-bg: #202020;
  --card-border: #2a2a2a;
  --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  --header-border: #2a2a2a;

  /* NAVBAR DARK MODE (Reset allo stato originale) */
  --navbar-bg: #202020;
  /* Usa lo stesso colore delle card (come nel tuo codice originale) */
  --navbar-shadow: none;
  /* Nessuna ombra in dark mode (come nel tuo codice originale) */

  --input-bg: #252525;
  --input-border: #2a2a2a;
  /* Aggiunto per compatibilità input */

  --otp-bg: #161616;
  /* Aggiunto per compatibilità OTP */
  --otp-border: #444444;
  /* Aggiunto per compatibilità OTP */
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
  /* Usa le variabili dinamiche */
  background-color: var(--navbar-bg);
  box-shadow: var(--navbar-shadow);

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
  font-weight: 800;
  font-size: 1.3rem;
  color: var(--accent-color);
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-right a {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 600;
  transition: color 0.2s;
  font-size: 0.95rem;
}

.nav-right a:hover {
  color: var(--accent-color);
}

/* Stile speciale per il link Admin */
.admin-link {
  color: #10b981 !important;
  font-weight: 800 !important;
  border: 2px solid #10b981;
  padding: 6px 12px;
  border-radius: 6px;
}

.admin-link:hover {
  background-color: #10b981;
  color: white !important;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-name-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--primary-color);
  border-right: 2px solid var(--header-border);
  padding-right: 15px;
  cursor: default;
}

.logout-link {
  cursor: pointer;
  color: #ef4444 !important;
  font-weight: 600;
}

/* Pulsante Tema */
.theme-btn {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s;
  color: var(--text-color);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.theme-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--accent-color);
}

/* Contenuto */
.main-content {
  flex: 1;
  padding: 30px 20px;
}

/* Footer */
.app-footer {
  text-align: center;
  padding: 30px;
  /* Il footer usa lo stesso sfondo della navbar per coerenza */
  background-color: var(--navbar-bg);
  color: var(--secondary-text);
  font-size: 0.9rem;
  border-top: 1px solid var(--header-border);
  margin-top: auto;
}

.nav-right a.router-link-active {
  color: var(--accent-color);
  border-bottom: 2px solid var(--accent-color);
}

.nav-right a.router-link-active.admin-link {
  border-bottom: 2px solid #10b981;
  background-color: #10b981;
  color: white !important;
}
</style>
