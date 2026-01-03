import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router' // <--- 1. IMPORTANTE: Importa il router

const app = createApp(App)

app.use(createPinia())
app.use(router) // <--- 2. IMPORTANTE: Usa il router

app.mount('#app')
