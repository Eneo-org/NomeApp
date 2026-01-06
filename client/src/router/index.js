import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore'

// Import delle View
import HomeView from '../views/HomeView.vue'
import ArchiveView from '../views/ArchiveView.vue'
import InitiativeDetail from '../views/InitiativeDetail.vue'
import LoginView from '../views/LoginView.vue'
import CreateInitiativeView from '../views/CreateInitiativeView.vue'
import UserDashboard from '../views/UserDashboard.vue'
import AdminCreateBudgetView from '../views/AdminCreateBudgetView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'
import AdminExpiringView from '../views/AdminExpiringView.vue'
import AdminDashboardView from '../views/AdminDashboardView.vue'
import AdminModerationView from '../views/AdminModerationView.vue'
import AdminInitiativeReplyView from '../views/AdminInitiativeReplyView.vue'
import ParticipatoryBudgetResultsView from '../views/ParticipatoryBudgetResultsView.vue'

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
      component: UserDashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/create-budget',
      name: 'create-budget',
      component: AdminCreateBudgetView,
    },
    {
      path: '/admin/users',
      component: AdminUsersView,
    },
    {
      path: '/admin/expiring',
      component: AdminExpiringView,
    },
    { path: '/admin/dashboard', component: AdminDashboardView },
    { path: '/admin/moderation', component: AdminModerationView },
    {
      path: '/admin/reply/:id',
      component: AdminInitiativeReplyView,
      // (In futuro qui metteremo meta: { requiresAdmin: true })
    },
    {
      path: '/participatory-budget/:id',
      name: 'participatory-budget-results',
      component: ParticipatoryBudgetResultsView,
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
