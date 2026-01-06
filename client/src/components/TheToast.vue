<script setup>
import { useToastStore } from '../stores/toastStore';
const store = useToastStore();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="msg in store.messages" :key="msg.id" class="toast-message" :class="msg.type">
        <span>{{ msg.text }}</span>
        <button @click="store.removeToast(msg.id)" class="close-btn">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast-message {
  padding: 15px 20px;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 250px;
}

/* Colori in base al tipo */
.success {
  background-color: #27ae60;
}

/* Verde */
.error {
  background-color: #e74c3c;
}

/* Rosso */
.info {
  background-color: #3498db;
}

/* Blu */

.close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
  margin-left: auto;
}

/* Animazioni Vue */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
</style>
