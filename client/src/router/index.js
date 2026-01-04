import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore' // Importiamo lo store per i controlli

// Import delle View
import HomeView from '../views/HomeView.vue'
import ArchiveView from '../views/ArchiveView.vue'
import InitiativeDetail from '../views/InitiativeDetail.vue'
import LoginView from '../views/LoginView.vue'
import CreateInitiativeView from '../views/CreateInitiativeView.vue'
import DashboardView from '../views/DashboardView.vue' // <--- NUOVO IMPORT

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/archive',
      name: 'archive',
      component: ArchiveView,
    },
    {
      path: '/initiative/:id',
      name: 'initiative-detail',
      component: InitiativeDetail,
      props: true,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/create',
      name: 'create',
      component: CreateInitiativeView,
      meta: { requiresAuth: true }, // <--- PROTEZIONE: Serve il login
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }, // <--- PROTEZIONE: Serve il login
    },
  ],
})

// --- NAVIGATION GUARD (PROTEZIONE GLOBALE) ---
// Questa funzione viene eseguita PRIMA di ogni cambio pagina
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  // Se l'utente non è caricato ma c'è un ID nel localStorage, proviamo a ripristinarlo subito
  // Questo evita che un refresh sulla dashboard ti butti fuori per errore
  if (!userStore.isAuthenticated && localStorage.getItem('tp_mock_id')) {
    await userStore.initializeStore()
  }

  // Controlliamo se la rotta richiede autenticazione (meta: { requiresAuth: true })
  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    // Se serve login e non sei loggato -> Vai al Login
    next('/login')
  } else {
    // Altrimenti -> Procedi pure
    next()
  }
})

export default router
