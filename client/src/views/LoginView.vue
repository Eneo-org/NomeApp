<script setup>
import { ref } from 'vue';
import { useUserStore } from '../stores/userStore';
import { useRouter } from 'vue-router';
// 1. IMPORTA TOAST
import { useToastStore } from '../stores/toastStore';

const store = useUserStore();
const router = useRouter();
const toast = useToastStore(); // 2. ISTANZIA

// Credenziali
const email = ref('');
const password = ref('');

const handleLogin = async () => {
  // Validazione base
  if (!email.value) {
    toast.showToast("⚠️ Inserisci l'email per accedere.", "error");
    return;
  }

  // Chiamata allo store
  const success = await store.login(email.value, password.value);

  if (success) {
    toast.showToast(`Benvenuto, ${store.user?.name || 'Utente'}! 👋`, "success");
    router.push('/');
  } else {
    toast.showToast("❌ Credenziali non riconosciute. Riprova.", "error");
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Accedi a Trento Partecipa</h1>
      <p class="sub-text">Entra per proporre, votare e discutere.</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="nome@esempio.it" required />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" />
        </div>

        <button type="submit" class="login-btn">Accedi</button>
      </form>

      <div class="demo-box">
        <h3>🔑 Credenziali Demo</h3>
        <div class="demo-row" @click="email = 'mario.rossi@email.com'; password = 'demo'">
          <strong>Cittadino:</strong> mario.rossi@email.com
        </div>
        <div class="demo-row" @click="email = 'admin@comune.trento.it'; password = 'demo'">
          <strong>Admin:</strong> admin@comune.trento.it
        </div>
        <p class="hint">(Clicca per riempire automaticamente)</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* STILI IDENTICI A PRIMA (Ho rimosso solo .error-box che non serve più) */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 20px;
}

.login-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 40px;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  color: var(--text-color);
}

.login-card h1 {
  margin-bottom: 5px;
  color: var(--accent-color);
}

.sub-text {
  color: var(--secondary-text);
  margin-bottom: 30px;
}

.form-group {
  text-align: left;
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--header-border);
  background: var(--input-bg);
  color: var(--text-color);
  box-sizing: border-box;
}

.login-btn {
  width: 100%;
  background: var(--accent-color);
  color: white;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.login-btn:hover {
  background: #3aa876;
}

.demo-box {
  margin-top: 30px;
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
  text-align: left;
  border: 1px dashed var(--secondary-text);
}

.demo-box h3 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: var(--text-color);
}

.demo-row {
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  font-family: monospace;
  font-size: 0.9rem;
}

.demo-row:hover {
  background: rgba(255, 255, 255, 0.1);
}

.hint {
  font-size: 0.75rem;
  color: var(--secondary-text);
  margin-top: 10px;
  text-align: center;
}
</style>
