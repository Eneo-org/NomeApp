<script setup>
import { ref, onMounted, computed, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
// Importiamo lo stesso composable del tema usato in App.vue
import { useTheme } from '@/composables/useTheme';

const store = useUserStore();
const router = useRouter();
const toast = useToastStore();
const { isDark } = useTheme(); // Rileva il tema corrente

// --- STATO ---
const step = ref(1);
const otpDigits = ref(['', '', '', '', '', '']);
const editableEmail = ref('');
const isLoading = ref(false);
const localErrorMessage = ref('');
const otpInputs = ref([]);

const otpCode = computed(() => otpDigits.value.join(''));

// --- TIMER ---
const OTP_DURATION = 300;
const timeLeft = ref(OTP_DURATION);
const timerInterval = ref(null);

const progressWidth = computed(() => (timeLeft.value / OTP_DURATION) * 100);
const formattedTime = computed(() => {
  const m = Math.floor(timeLeft.value / 60);
  const s = timeLeft.value % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
});

const startTimer = () => {
  clearInterval(timerInterval.value);
  timeLeft.value = OTP_DURATION;
  timerInterval.value = setInterval(() => {
    if (timeLeft.value > 0) timeLeft.value--;
    else clearInterval(timerInterval.value);
  }, 1000);
};

const stopTimer = () => clearInterval(timerInterval.value);
onUnmounted(() => stopTimer());

// --- INIT ---
onMounted(() => {
  if (!store.tempRegistrationData) {
    router.push('/login');
  } else {
    editableEmail.value = store.tempRegistrationData.email;
  }
});

// --- LOGICA INPUT ---
const handleOtpInput = (index, event) => {
  const value = event.target.value;
  if (!/^\d*$/.test(value)) {
    otpDigits.value[index] = '';
    return;
  }
  localErrorMessage.value = '';
  if (value && index < 5) {
    otpInputs.value[index + 1]?.focus();
  }
};

const handleOtpPaste = (event) => {
  event.preventDefault();
  const pastedData = event.clipboardData.getData('text').slice(0, 6);
  if (/^\d+$/.test(pastedData)) {
    pastedData.split('').forEach((digit, i) => {
      if (i < 6) otpDigits.value[i] = digit;
    });
    const lastIndex = Math.min(pastedData.length - 1, 5);
    nextTick(() => otpInputs.value[lastIndex]?.focus());
  }
};

const handleOtpKeydown = (index, event) => {
  if (event.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    otpInputs.value[index - 1]?.focus();
  }
};

// --- AZIONI ---
const handleSendOtp = async () => {
  localErrorMessage.value = '';
  if (!editableEmail.value.includes('@')) {
    toast.showToast("Inserisci un'email valida", "warning");
    return;
  }
  isLoading.value = true;
  try {
    const success = await store.sendOtp(editableEmail.value);
    if (success) {
      toast.showToast(`Codice inviato!`, "success");
      step.value = 2;
      startTimer();
      nextTick(() => otpInputs.value[0]?.focus());
    }
  } catch (error) {
    toast.showToast(error, "error");
  } finally {
    isLoading.value = false;
  }
};

const handleCompleteRegistration = async () => {
  if (otpCode.value.length < 6) return;
  localErrorMessage.value = '';
  isLoading.value = true;
  try {
    const success = await store.registerUser(editableEmail.value, otpCode.value);
    if (success) {
      stopTimer();
      toast.showToast("Benvenuto a bordo! 🚀", "success");
      router.push('/');
    }
  } catch (error) {
    localErrorMessage.value = error;
    if (error.includes('errato') || error.includes('scaduto')) {
      otpDigits.value = ['', '', '', '', '', ''];
      otpInputs.value[0]?.focus();
    }
  } finally {
    isLoading.value = false;
  }
};

const resetFlow = () => {
  step.value = 1;
  stopTimer();
  localErrorMessage.value = '';
  otpDigits.value = ['', '', '', '', '', ''];
};
</script>

<template>
  <div class="register-view-container" :class="{ 'dark-theme': isDark }">

    <div class="card-box">
      <transition name="fade-slide" mode="out-in">

        <div v-if="step === 1" key="step1" class="step-wrapper">
          <div class="header-section">
            <h2>Quasi finito!</h2>
            <p class="subtitle">Conferma la tua email per ricevere il codice di sicurezza.</p>
          </div>

          <div class="input-group">
            <label>La tua Email</label>
            <div class="input-wrapper">
              <i class="icon-mail">✉️</i>
              <input v-model="editableEmail" type="email" placeholder="nome@esempio.com" :disabled="isLoading"
                class="standard-input" />
            </div>
          </div>

          <button class="btn-primary" @click="handleSendOtp" :disabled="isLoading">
            <span v-if="isLoading" class="loader"></span>
            <span v-else>Invia Codice OTP</span>
          </button>

          <div class="info-note">
            <p>Non condivideremo mai la tua email con terze parti.</p>
          </div>
        </div>

        <div v-else key="step2" class="step-wrapper">
          <div class="header-section">
            <h2>Verifica Sicurezza</h2>
            <p class="subtitle">Abbiamo inviato un codice a <br><strong class="highlight-email">{{ editableEmail
                }}</strong></p>
          </div>

          <div class="timer-display" :class="{ 'expired': timeLeft === 0 }">
            <div class="timer-text">
              <span v-if="timeLeft > 0">Scade tra: <strong>{{ formattedTime }}</strong></span>
              <span v-else>⚠️ Codice Scaduto</span>
            </div>
            <div class="progress-bg">
              <div class="progress-fill" :style="{ width: progressWidth + '%' }"></div>
            </div>
          </div>

          <div class="input-group otp-group">
            <label>Codice OTP a 6 cifre</label>

            <div class="otp-inputs-container" @paste="handleOtpPaste">
              <input v-for="(digit, index) in 6" :key="index" ref="otpInputs" type="text" inputmode="numeric"
                maxlength="1" v-model="otpDigits[index]" class="otp-box" :disabled="timeLeft === 0 || isLoading"
                @input="handleOtpInput(index, $event)" @keydown="handleOtpKeydown(index, $event)" />
            </div>

            <transition name="shake">
              <p v-if="localErrorMessage" class="error-badge">
                {{ localErrorMessage }}
              </p>
            </transition>
          </div>

          <button class="btn-primary" @click="handleCompleteRegistration"
            :disabled="isLoading || timeLeft === 0 || otpCode.length < 6">
            <span v-if="isLoading" class="loader"></span>
            <span v-else>Conferma Registrazione</span>
          </button>

          <button class="btn-text" @click="resetFlow">
            {{ timeLeft === 0 ? "Invia un nuovo codice" : "Ho sbagliato email" }}
          </button>
        </div>

      </transition>
    </div>
  </div>
</template>

<style scoped>
/* --- LAYOUT CONTAINER --- */
.register-view-container {
  width: 100%;
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  /* Nessun colore di sfondo qui: usa quello globale di App.vue (#F3F4F6) */
}

/* --- CARD CENTRALE --- */
.card-box {
  width: 100%;
  max-width: 420px;

  /* Usa le variabili globali definite in App.vue */
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);

  border-radius: 12px;
  padding: 40px;
  text-align: center;
  position: relative;
  margin: auto;
}

/* --- TYPOGRAPHY --- */
h2 {
  margin: 0 0 10px 0;
  color: var(--text-color);
  /* Usa var globale */
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--secondary-text);
  /* Usa var globale */
  font-size: 0.95rem;
  line-height: 1.5;
}

.highlight-email {
  color: var(--primary-color);
  /* Usa il Blu globale */
}

/* --- INPUTS --- */
.input-group {
  margin: 25px 0;
  text-align: left;
}

.input-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--secondary-text);
}

.input-wrapper {
  position: relative;
}

.icon-mail {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  font-style: normal;
  /* Opzionale: colorare l'icona con il testo */
  color: var(--text-color);
}

.standard-input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border-radius: 8px;

  /* Usa variabili globali */
  border: 1px solid var(--input-border);
  background-color: var(--input-bg);
  color: var(--text-color);

  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.standard-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
  /* Blu trasparente */
}

/* --- OTP INPUTS --- */
.otp-group {
  text-align: center;
}

.otp-inputs-container {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.otp-box {
  width: 45px;
  height: 55px;
  text-align: center;
  font-size: 1.4rem;
  font-weight: bold;
  border-radius: 8px;

  /* Usa variabili globali (aggiunte in App.vue per comodità o mappate qui) */
  border: 1px solid var(--otp-border);
  background-color: var(--otp-bg);
  color: var(--text-color);

  transition: all 0.2s;
  -moz-appearance: textfield;
}

.otp-box::-webkit-inner-spin-button,
.otp-box::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.otp-box:focus {
  outline: none;
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

/* --- TIMER --- */
.timer-display {
  background-color: var(--otp-bg);
  border: 1px solid var(--otp-border);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.timer-text {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--secondary-text);
  margin-bottom: 8px;
}

.progress-bg {
  height: 6px;
  background-color: var(--input-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--primary-color);
  transition: width 1s linear;
}

.timer-display.expired .timer-text {
  color: #dc3545;
}

.timer-display.expired .progress-fill {
  background-color: #dc3545;
}

/* --- BUTTONS --- */
.btn-primary {
  width: 100%;
  padding: 14px;

  /* Usa il Blu globale */
  background-color: var(--primary-color);
  color: white;

  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-text {
  background: none;
  border: none;
  color: var(--secondary-text);
  margin-top: 15px;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: underline;
}

.btn-text:hover {
  color: var(--text-color);
}

/* --- UTILS --- */
.info-note {
  margin-top: 20px;
  font-size: 0.8rem;
  color: var(--secondary-text);
}

.error-badge {
  color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
  padding: 8px;
  border-radius: 6px;
  margin-top: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.loader {
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* Transizioni */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.shake-enter-active {
  animation: shake 0.4s;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-5px);
  }

  75% {
    transform: translateX(5px);
  }
}
</style>
