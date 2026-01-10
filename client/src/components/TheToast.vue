<script setup>
import { useToastStore } from '../stores/toastStore';
import { storeToRefs } from 'pinia';

const store = useToastStore();
const { toasts } = storeToRefs(store);

const config = {
  success: { icon: '✅', title: 'Successo' },
  error: { icon: '❌', title: 'Errore' },
  info: { icon: 'ℹ️', title: 'Info' },
  prompt: { icon: '🔔', title: 'Notifiche' } // Nuovo tipo
};
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" class="toast-item"
        :class="[toast.type, { 'has-actions': toast.actions }]">
        <div class="toast-icon">{{ config[toast.type]?.icon || 'ℹ️' }}</div>

        <div class="toast-content-wrapper">
          <div class="toast-content">
            <strong class="toast-title">{{ config[toast.type]?.title }}</strong>
            <p class="toast-message">{{ toast.message }}</p>
          </div>

          <div v-if="toast.actions" class="toast-actions">
            <button v-for="(btn, index) in toast.actions" :key="index" class="action-btn"
              :class="btn.style || 'secondary'" @click="btn.onClick(toast.id)">
              {{ btn.label }}
            </button>
          </div>
        </div>

        <button class="close-btn" @click="store.removeToast(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  background: var(--card-bg, #ffffff);
  color: var(--text-color, #1e293b);
  border: 1px solid var(--card-border, #e2e8f0);
  min-width: 320px;
  max-width: 400px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;

  border-left-width: 5px;
  border-left-style: solid;
}

/* Colori bordo */
.toast-item.success {
  border-left-color: #27ae60;
}

.toast-item.error {
  border-left-color: #e74c3c;
}

.toast-item.info {
  border-left-color: #3498db;
}

.toast-item.prompt {
  border-left-color: #f1c40f;
}

/* Giallo per i prompt */

.toast-icon {
  font-size: 1.4rem;
  line-height: 1;
  padding-top: 2px;
}

.toast-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast-title {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.toast-message {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
  line-height: 1.4;
}

/* Stili Bottoni Interni */
.toast-actions {
  display: flex;
  gap: 8px;
  margin-top: 5px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn.primary {
  background-color: var(--accent-color, #42b883);
  color: white;
}

.action-btn.secondary {
  background-color: transparent;
  border: 1px solid var(--header-border, #ccc);
  color: var(--text-color, #333);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 0.5;
  color: #999;
  cursor: pointer;
  padding: 0;
  margin-left: 5px;
}

.close-btn:hover {
  color: var(--text-color);
}

/* Animazioni */
.toast-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.toast-enter-active {
  transition: all 0.4s ease-out;
}

.toast-leave-to {
  opacity: 0;
}

.toast-leave-active {
  transition: all 0.4s ease-in;
}

.toast-move {
  transition: all 0.4s ease;
}
</style>
