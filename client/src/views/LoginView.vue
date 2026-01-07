<script setup>
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
// Importa il componente Google
import { GoogleLogin } from 'vue3-google-login';

const store = useUserStore();
const router = useRouter();
const toast = useToastStore();

// Funzione chiamata quando Google risponde con successo
const handleGoogleCallback = async (response) => {
  // response.credential è il token JWT fornito da Google
  if (response.credential) {
    const success = await store.loginWithGoogle(response.credential);

    if (success) {
      toast.showToast(`Benvenuto, ${store.user?.firstName}! 👋`, "success");
      router.push('/');
    } else {
      toast.showToast("Errore durante l'accesso con Google.", "error");
    }
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Accedi a Trento Partecipa</h1>
      <p class="sub-text">Usa il tuo account Google per entrare.</p>

      <div class="google-btn-wrapper">
        <GoogleLogin :callback="handleGoogleCallback" prompt />
      </div>

      <div class="info-box">
        <p>ℹ️ <strong>Nota:</strong> In produzione, questo verrebbe sostituito da SPID/CIE.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.google-btn-wrapper {
  display: flex;
  justify-content: center;
  margin: 30px 0;
}

.info-box {
  margin-top: 20px;
  font-size: 0.85rem;
  color: var(--secondary-text);
  border-top: 1px solid var(--header-border);
  padding-top: 20px;
}
</style>
