<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'

const router = useRouter()
const userStore = useUserStore()

// --- LOGICA DARK MODE ---
const isDarkMode = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  applyTheme()
}

const applyTheme = () => {
  if (isDarkMode.value) {
    document.body.classList.add('dark-mode')
    localStorage.setItem('theme', 'dark')
  } else {
    document.body.classList.remove('dark-mode')
    localStorage.setItem('theme', 'light')
  }
}

// --- INITIALIZZAZIONE APP ---
onMounted(() => {
  // 1. Ripristina il Tema
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDarkMode.value = true
    document.body.classList.add('dark-mode')
  }

  // 2. Ripristina la Sessione Utente (IMPORTANTE!)
  // Controlla se c'è un token salvato e logga l'utente automaticamente
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

        <RouterLink v-if="!userStore.isAuthenticated" to="/login">Accedi</RouterLink>

        <div v-else class="user-menu">
          <RouterLink to="/dashboard" class="user-name-link">
            <span class="user-name">{{ userStore.fullName }}</span>
          </RouterLink>

          <a @click.prevent="logout" href="#" class="logout-link">Esci</a>
        </div>

        <button @click="toggleTheme" class="theme-btn" title="Cambia Tema">
          {{ isDarkMode ? '☀️' : '🌙' }}
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
body.dark-mode {
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

.user-menu {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-name {
  font-size: 0.9rem;
  font-weight: bold;
  color: var(--accent-color);
  border-right: 1px solid var(--secondary-text);
  padding-right: 15px;
}

.logout-link {
  cursor: pointer;
  color: #e74c3c !important;
  /* Rosso per il logout */
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

.user-name-link {
  text-decoration: none;
  display: flex;
  align-items: center;
}

.user-name-link:hover .user-name {
  text-decoration: underline;
  cursor: pointer;
}

/* Stile per il link attivo (quando sei sulla Dashboard) */
.nav-right a.router-link-active {
  color: var(--accent-color);
  font-weight: bold;
  border-bottom: 2px solid var(--accent-color);
  /* Sottolineatura verde */
}
</style>
