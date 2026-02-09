<script setup>
import { defineProps, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInitiativeStore } from '@/stores/initiativeStore'
import { useUserStore } from '@/stores/userStore'
import { useImage } from '@/composables/useImage'
import defaultImage from '@/assets/placeholder-initiative.jpg'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const initiativeStore = useInitiativeStore()
const userStore = useUserStore()
const { getImageUrl } = useImage()

// Gestione errore caricamento immagine
const handleImageError = (event) => {
  console.warn('⚠️ Errore caricamento immagine card, uso placeholder');
  event.target.src = defaultImage;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/D'
  return new Date(dateString).toLocaleDateString('it-IT')
}

const getStatusClass = (status) => {
  if (!status) return 'status-default';
  const s = status.toLowerCase();
  if (s === 'in corso') return 'status-active';
  if (s === 'approvata') return 'status-success';
  if (s === 'respinta') return 'status-danger';
  if (s === 'scaduta') return 'status-muted';
  return 'status-default';
}

const handleStarClick = async (event) => {
  event.stopPropagation() // Evita di triggerare il click sulla card
  if (!userStore.isAuthenticated) {
    if (confirm("Devi accedere per seguire le iniziative. Vuoi andare al login?")) {
      router.push('/login');
    }
    return;
  }
  await initiativeStore.toggleFollow(props.item.id, props.item.title);
}

const goToDetail = () => {
  // Tutte le iniziative (interne ed esterne) aprono la pagina di dettaglio locale
  router.push(`/initiative/${props.item.id}`);
}
</script>

<template>
  <div class="card" @click="goToDetail">
    <div class="card-image-wrapper">
      <div v-if="item.platformId !== 1" class="source-badge external">
        {{ initiativeStore.getPlatformName(item.platformId) }} ↗
      </div>
      <img :src="getImageUrl(item)" @error="handleImageError" class="card-img" alt="Immagine iniziativa">
    </div>

    <div class="card-content">
      <div class="card-top-row">
        <div class="status-badge-mini" :class="getStatusClass(item.status)">
          <span class="status-dot"></span>
          {{ item.status }}
        </div>

        <button v-if="item.status && item.status.toLowerCase() === 'in corso'" class="follow-btn-wrapper"
          @click.prevent="handleStarClick" title="Segui questa iniziativa">
          <span v-if="initiativeStore.isFollowed(item.id)" class="followed-badge">★ Segui già</span>
          <span v-else class="unfollowed-badge">☆ Segui aggiornamenti</span>
        </button>
      </div>

      <div class="card-header">
        <h3>{{ item.title }}</h3>
        <span class="category-tag">{{ initiativeStore.getCategoryName(item.categoryId) }}</span>
      </div>

      <div class="card-meta">
        <span>📍 {{ item.place || 'Trento' }}</span>
        <span>📅 {{ formatDate(item.creationDate) }}</span>
      </div>

      <div class="card-footer">
        <span class="signatures-text">Firme raccolte: {{ item.signatures }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  gap: 0;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  height: 200px;
  cursor: pointer;
  transition: box-shadow 0.3s, transform 0.3s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.card-image-wrapper {
  flex: 0 0 250px;
  background: #2c3e50;
  position: relative;
  overflow: hidden;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* SOURCE BADGE */
.source-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.source-badge.external {
  background-color: #e74c3c;
  color: white;
}

/* CONTENUTO CARD */
.card-content {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-badge-mini {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: white;
}

.status-badge-mini .status-dot {
  background: white;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

/* Colori status */
.status-active {
  background: #3498db;
}

.status-success {
  background: #27ae60;
}

.status-danger {
  background: #e74c3c;
}

.status-muted {
  background: #95a5a6;
}

.status-default {
  background: #7f8c8d;
}

.card-header {
  margin-bottom: 8px;
}

.card-header h3 {
  margin: 0 0 5px 0;
  font-size: 1.5rem;
  line-height: 1.2;
  color: var(--text-color);
  font-weight: 800;
}

.category-tag {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--secondary-text);
  background: var(--input-bg);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--header-border);
}

.follow-btn-wrapper {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.followed-badge,
.unfollowed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.85rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.followed-badge {
  border: 2px solid #f1c40f;
  color: #f39c12;
  background: rgba(241, 196, 15, 0.1);
}

.unfollowed-badge {
  border: 1px solid var(--secondary-text);
  color: var(--secondary-text);
  background: transparent;
}

.follow-btn-wrapper:hover .unfollowed-badge {
  border-color: #f1c40f;
  color: #f1c40f;
  background: rgba(241, 196, 15, 0.05);
}

/* META DATA */
.card-meta {
  display: flex;
  gap: 20px;
  font-size: 0.85rem;
  color: var(--secondary-text);
  margin-bottom: 12px;
}

/* FOOTER CARD */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid var(--header-border);
}

.signatures-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}
</style>
