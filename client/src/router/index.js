import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore'

// Import delle View
import HomeView from '../views/HomeView.vue'
import ArchiveView from '../views/ArchiveView.vue'
import InitiativeDetail from '../views/InitiativeDetail.vue'
import LoginView from '../views/LoginView.vue'
import CreateInitiativeView from '../views/CreateInitiativeView.vue'

// --- FIX IMPORTANTE ---
// Prima importavi 'DashboardView.vue', ora puntiamo al file corretto 'UserDashboard.vue'
import UserDashboard from '../views/UserDashboard.vue'

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
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: UserDashboard, // <--- ORA USIAMO IL COMPONENTE NUOVO
      meta: { requiresAuth: true },
    },
  ],
})

// --- NAVIGATION GUARD ---
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  if (!userStore.isAuthenticated && localStorage.getItem('tp_mock_id')) {
    await userStore.initializeStore()
  }

  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router
