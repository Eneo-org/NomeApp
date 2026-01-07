import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 1. IMPORTA IL PLUGIN
import vue3GoogleLogin from 'vue3-google-login'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 2. CONFIGURA IL PLUGIN (Importante: fallo PRIMA di app.mount!)
app.use(vue3GoogleLogin, {
  clientId: '86056164816-hta85akkjjfc5h53p17vrgoo531ebsv7.apps.googleusercontent.com',
})

// 3. AVVIA L'APP (Deve essere l'ultima riga)
app.mount('#app')
