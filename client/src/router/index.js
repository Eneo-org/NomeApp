import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ArchiveView from '../views/ArchiveView.vue'
import InitiativeDetail from '../views/InitiativeDetail.vue'
import LoginView from '../views/LoginView.vue'
import CreateInitiativeView from '../views/CreateInitiativeView.vue'

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
      props: true, // Passa l'ID come prop se serve
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/create', // <--- NUOVA ROTTA
      name: 'create',
      component: CreateInitiativeView,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
  ],
})

export default router
