<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/userStore'
import { useToastStore } from '../stores/toastStore'

const store = useUserStore()
const router = useRouter()
const route = useRoute()
const toast = useToastStore()

const secret = ref('')
const isLoading = ref(false)

const testAccounts = [
    {
        key: 'mario-rossi',
        label: 'Mario Rossi',
        description: 'Cittadino (firma, voto e interazioni utente)',
    },
    {
        key: 'luigi-verdi',
        label: 'Luigi Verdi',
        description: 'Admin (dashboard, moderazione, gestione utenti)',
    },
    {
        key: 'giulia-bianchi',
        label: 'Giulia Bianchi',
        description: 'Admin + cittadino (test completo)',
    },
]

const handleTeacherLogin = async (accountKey) => {
    if (!secret.value) {
        toast.showToast('Inserisci il secret docenti.', 'warning')
        return
    }

    try {
        isLoading.value = true
        const result = await store.loginWithTeacherSecret(secret.value, accountKey)

        if (result) {
            toast.showToast(`Accesso effettuato. Benvenuto, ${store.fullName}!`, 'success')
            const redirectPath =
                typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
                    ? route.query.redirect
                    : '/'
            router.push(redirectPath)
        } else {
            toast.showToast('Accesso non riuscito.', 'error')
        }
    } catch (errMessage) {
        toast.showToast(errMessage, 'error')
    } finally {
        isLoading.value = false
    }
}
</script>

<template>
    <div class="login-container">
        <div class="login-card">
            <h1>Accesso Docenti</h1>
            <p class="sub-text">Inserisci il secret e scegli uno dei tre account test.</p>

            <div class="secret-field">
                <label for="teacher-secret">Secret docenti</label>
                <input id="teacher-secret" v-model="secret" type="password" autocomplete="off"
                    placeholder="Inserisci il secret" />
            </div>

            <div class="accounts-grid">
                <button v-for="account in testAccounts" :key="account.key" class="account-button"
                    :disabled="!secret || isLoading" @click="handleTeacherLogin(account.key)">
                    <div class="account-title">{{ account.label }}</div>
                    <div class="account-desc">{{ account.description }}</div>
                </button>
            </div>

            <div class="info-box">
                <p>ℹ️ <strong>Nota:</strong> accesso riservato ai docenti. Non condividere il secret.</p>
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
    max-width: 460px;
    text-align: center;
    color: var(--text-color);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.sub-text {
    color: var(--secondary-text);
    margin-bottom: 24px;
}

.secret-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
    text-align: left;
}

.secret-field label {
    font-size: 0.85rem;
    color: var(--secondary-text);
}

.secret-field input {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    color: var(--text-color);
    padding: 12px 14px;
    border-radius: 8px;
    outline: none;
}

.accounts-grid {
    display: grid;
    gap: 12px;
    margin-bottom: 20px;
}

.account-button {
    border: 1px solid var(--card-border);
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-color);
    padding: 14px 16px;
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease;
}

.account-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.account-button:not(:disabled):hover {
    transform: translateY(-1px);
    border-color: var(--accent-color);
}

.account-title {
    font-weight: 600;
    margin-bottom: 4px;
}

.account-desc {
    font-size: 0.85rem;
    color: var(--secondary-text);
}

.info-box {
    margin-top: 10px;
    font-size: 0.85rem;
    color: var(--secondary-text);
    border-top: 1px solid var(--header-border);
    padding-top: 20px;
}
</style>
