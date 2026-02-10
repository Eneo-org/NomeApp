<script setup>
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import TheToast from './components/TheToast.vue'
import { useDashboardStore } from './stores/dashboardStore';
import { useInitiativeStore } from './stores/initiativeStore';
import { storeToRefs } from 'pinia';
import { useTheme } from '@/composables/useTheme';

const router = useRouter()
const userStore = useUserStore()
const initiativeStore = useInitiativeStore()
const { isDark, toggleTheme, initTheme } = useTheme();
const dashboardStore = useDashboardStore();

const { notifications, unreadCount } = storeToRefs(dashboardStore);

const searchTerm = ref('');

const handleSearch = () => {
  router.push({ path: '/initiatives', query: { search: searchTerm.value.trim() } });
  searchTerm.value = '';
};

// Calcola l'iniziale dell'utente per l'avatar
const userInitial = computed(() => {
  const firstName = userStore.user?.firstName || userStore.user?.name || userStore.fullName;
  return firstName ? firstName.trim().charAt(0).toUpperCase() : 'U';
});

const logout = () => {
  userStore.logout()
  router.push('/login')
}

// Notifications
const showNotifications = ref(false);

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value) {
    markAllAsRead();
  }
};

const markAllAsRead = () => {
  dashboardStore.markAllAsRead();
};

const handleNotificationClick = (notification) => {
  dashboardStore.markAsRead(notification.id);
  if (notification.relatedTo === 'initiative' && notification.initiativeId) {
    router.push({ name: 'initiative-detail', params: { id: notification.initiativeId } });
  }
  showNotifications.value = false;
};

onMounted(() => {
  initTheme();
  userStore.initializeStore();

  // Carica filtri globalmente una sola volta
  initiativeStore.fetchFiltersData();

  if (userStore.isAuthenticated) {
    dashboardStore.fetchNotifications();
  }

  const handleOutsideClick = (event) => {
    if (showNotifications.value && !event.target.closest('.notification-wrapper')) {
      showNotifications.value = false;
    }
  };
  document.addEventListener('click', handleOutsideClick);
});

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
</script>
<template>
  <div class="app-layout">

    <TheToast />



    <nav class="navbar">

      <div class="nav-left">

        <RouterLink to="/" class="brand-logo-inline">

          <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-icon">

            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />

          </svg>



          <span class="brand-text-inline">

            <span class="brand-city">Trento</span><span class="brand-action">Partecipa</span>

          </span>

        </RouterLink>

      </div>



      <div class="nav-center">

        <form @submit.prevent="handleSearch" class="nav-search-form">

          <input type="text" v-model="searchTerm" placeholder="Cerca iniziative..." class="nav-search-input">

          <button type="submit" class="nav-search-btn">

            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">

              <circle cx="11" cy="11" r="8" />

              <line x1="21" y1="21" x2="16.65" y2="16.65" />

            </svg>

          </button>

        </form>

      </div>



      <div class="nav-right">

        <RouterLink to="/" class="nav-link">Home</RouterLink>

        <RouterLink :to="{ path: '/initiatives', query: { status: 'In corso' } }" class="nav-link">Iniziative
        </RouterLink>



        <RouterLink v-if="userStore.isAuthenticated" to="/dashboard" class="nav-link">

          Dashboard

        </RouterLink>



        <RouterLink v-if="userStore.isAuthenticated && userStore.user?.isAdmin" to="/admin/dashboard"
          class="nav-link admin-pill">

          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />

          </svg>

          Area Admin

        </RouterLink>



        <RouterLink v-if="!userStore.isAuthenticated" to="/login" class="login-btn">

          Accedi

        </RouterLink>



        <div v-else class="user-control-panel">

          <div class="notification-wrapper">

            <button @click="toggleNotifications" class="notification-btn">

              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />

                <path d="M13.73 21a2 2 0 0 1-3.46 0" />

              </svg>

              <span class="notification-badge" v-if="unreadCount > 0">{{ unreadCount }}</span>

            </button>



            <div v-if="showNotifications" class="notifications-dropdown" @click.stop>

              <div class="dropdown-header">

                <h4>Notifiche</h4>

                <button @click="markAllAsRead" class="mark-as-read-btn" v-if="unreadCount > 0">Segna come lette</button>

              </div>

              <ul class="notification-list">

                <li v-for="notification in notifications" :key="notification.id"
                  @click="handleNotificationClick(notification)" :class="{ 'is-read': notification.isRead }">

                  <p>{{ notification.text }}</p>

                  <small>{{ formatDate(notification.creationDate) }}</small>

                </li>

                <li v-if="notifications.length === 0" class="no-notifications">

                  Nessuna notifica

                </li>

              </ul>

            </div>

          </div>

          <div class="divider-vertical"></div>

          <div class="user-info">

            <div class="avatar-circle">{{ userInitial }}</div>

            <span class="user-name">{{ userStore.fullName }}</span>

          </div>

          <div class="divider-vertical"></div>

          <button @click="logout" class="logout-icon-btn" title="Esci">

            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />

              <polyline points="16 17 21 12 16 7" />

              <line x1="21" y1="12" x2="9" y2="12" />

            </svg>

          </button>

        </div>



        <button @click="toggleTheme" class="theme-toggle-btn"
          :title="isDark ? 'Passa a Light Mode' : 'Passa a Dark Mode'">

          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

            <circle cx="12" cy="12" r="5" />

            <line x1="12" y1="1" x2="12" y2="3" />

            <line x1="12" y1="21" x2="12" y2="23" />

            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />

            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />

            <line x1="1" y1="12" x2="3" y2="12" />

            <line x1="21" y1="12" x2="23" y2="12" />

            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />

            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />

          </svg>

          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />

          </svg>

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
/* --- VARIABILI GLOBALI (Light Mode) --- */
:root {
  --bg-color: #E2E8F0;
  --text-color: #1e293b;
  --secondary-text: #64748b;

  --card-bg: #ffffff;
  --card-border: #94A3B8;
  --card-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);

  --navbar-bg: #FFFFFF;
  --navbar-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  --header-border: #e2e8f0;

  --input-bg: #f8fafc;
  --input-border: #cbd5e1;
  --otp-bg: #FFFFFF;
  --otp-border: #94A3B8;

  --accent-color: #10b981;
  /* Verde Smeraldo */
  --accent-hover: #059669;

  --user-panel-bg: #f1f5f9;
  --nav-hover: #10b981;
}

/* --- VARIABILI DARK MODE (ORIGINALI) --- */
body.dark-mode,
body.dark {
  --bg-color: #161616;
  --text-color: #e0e0e0;
  --secondary-text: #a0a0a0;

  --card-bg: #202020;
  --card-border: #2a2a2a;
  --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  --header-border: #2a2a2a;
  --navbar-bg: #202020;
  --navbar-shadow: none;

  --input-bg: #252525;
  --input-border: #2a2a2a;
  --otp-bg: #2a2a2a;
  --otp-border: #5a5a5a;

  --user-panel-bg: #2a2a2a;
  --nav-hover: #10b981;
}

/* BASE */
body {
  margin: 0;
  font-family: 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* --- NAVBAR STYLING --- */
.navbar {
  background-color: var(--navbar-bg);
  border-bottom: 1px solid var(--header-border);
  box-shadow: var(--navbar-shadow);
  padding: 0 25px;
  height: 70px;
  display: flex;
  align-items: center;
  gap: 20px;
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: background-color 0.3s;
}

.nav-left {
  flex-shrink: 0;
}

/* --- STILE LOGO BRAND --- */
.brand-logo-inline {
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: opacity 0.2s;
}

.brand-logo-inline:hover {
  opacity: 0.85;
}

.brand-icon {
  color: var(--accent-color);
  flex-shrink: 0;
}

.brand-text-inline {
  font-size: 1.7rem;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.brand-city {
  font-weight: 500;
  color: var(--text-color);
  letter-spacing: -0.5px;
}

.brand-action {
  font-weight: 900;
  background: linear-gradient(90deg, var(--text-color) 15%, var(--accent-color) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -1px;
}

/* --- NAV SEARCH (REFACTORED) --- */
.nav-center {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  min-width: 200px;
}

.nav-search-form {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 480px;
  background-color: var(--input-bg);
  border: 1px solid var(--header-border);
  border-radius: 22px;
  transition: all 0.2s;
}

.nav-search-form:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.nav-search-input {
  flex-grow: 1;
  width: 100%;
  height: 42px;
  padding: 0 20px;
  background-color: transparent;
  border: none;
  outline: none;
  color: var(--text-color);
  font-size: 0.95rem;
}

.nav-search-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin-right: 4px;
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.nav-search-btn:hover {
  background: var(--accent-hover);
}


/* --- NAVIGAZIONE DESTRA --- */
.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.nav-link {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  font-size: 0.95rem;
  padding: 5px 0;
  position: relative;
  transition: color 0.2s;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--nav-hover);
}

.nav-link.router-link-active {
  color: var(--nav-hover);
  font-weight: 700;
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--nav-hover);
  border-radius: 2px;
}

.nav-link.admin-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--accent-color) !important;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.nav-link.admin-pill::after {
  display: none;
}

.nav-link.admin-pill:hover {
  background-color: var(--accent-color);
  color: white !important;
}

.login-btn {
  background-color: var(--accent-color);
  color: white;
  text-decoration: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.login-btn:hover {
  background-color: var(--accent-hover);
}

/* --- AREA UTENTE --- */
.user-control-panel {
  display: flex;
  align-items: center;
  background-color: var(--user-panel-bg);
  padding: 4px 6px 4px 12px;
  border-radius: 30px;
  border: 1px solid var(--header-border);
  gap: 10px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar-circle {
  width: 28px;
  height: 28px;
  background-color: var(--accent-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.divider-vertical {
  width: 1px;
  height: 20px;
  background-color: var(--secondary-text);
  opacity: 0.3;
}

.logout-icon-btn {
  background: transparent;
  border: none;
  color: var(--secondary-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: 50%;
  transition: all 0.2s;
}

.logout-icon-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* TOGGLE THEME */
.theme-toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary-text);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  transition: background 0.2s, color 0.2s;
  margin-left: 5px;
}

.theme-toggle-btn:hover {
  background-color: var(--user-panel-bg);
  color: var(--text-color);
}

/* FOOTER */
.app-footer {
  text-align: center;
  padding: 25px;
  background-color: var(--navbar-bg);
  border-top: 1px solid var(--header-border);
  color: var(--secondary-text);
  font-size: 0.85rem;
  margin-top: auto;
}

/* RESPONSIVE */
@media (max-width: 1024px) {
  .user-name {
    display: none;
  }

  .nav-right {
    gap: 10px;
  }
}

@media (max-width: 768px) {
  .navbar {
    padding: 15px;
    height: auto;
    flex-direction: column;
    gap: 15px;
  }

  .nav-center {
    min-width: 100%;
    padding: 0;
    order: 3;
  }

  .nav-right {
    order: 2;
  }

  .nav-left {
    order: 1;
  }

  .nav-link {
    display: inline-block;
  }

  .user-name {
    display: inline-block;
  }

  .nav-right {
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
  }
}

/* NOTIFICATION STYLES */
.notification-wrapper {
  position: relative;
}

.notification-btn {
  background: transparent;
  border: none;
  color: var(--secondary-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: 50%;
  transition: all 0.2s;
  position: relative;
}

.notification-btn:hover {
  background-color: var(--user-panel-bg);
  color: var(--text-color);
}

.notification-badge {
  position: absolute;
  top: 0px;
  right: 0px;
  background-color: #ef4444;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border: 2px solid var(--navbar-bg);
}

.notifications-dropdown {
  position: absolute;
  top: 50px;
  right: 0;
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: var(--card-shadow);
  width: 350px;
  z-index: 1001;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--header-border);
}

.dropdown-header h4 {
  margin: 0;
  font-size: 1rem;
}

.mark-as-read-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.notification-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.notification-list li {
  padding: 12px 16px;
  border-bottom: 1px solid var(--header-border);
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-list li:hover {
  background-color: var(--user-panel-bg);
}

.notification-list li:last-child {
  border-bottom: none;
}

.notification-list li p {
  margin: 0 0 4px 0;
  font-size: 0.9rem;
}

.notification-list li small {
  font-size: 0.8rem;
  color: var(--secondary-text);
}

.notification-list li.is-read p {
  opacity: 0.6;
}

.no-notifications {
  padding: 20px;
  text-align: center;
  color: var(--secondary-text);
}
</style>
