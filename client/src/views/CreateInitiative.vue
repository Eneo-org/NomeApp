<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useUserStore } from '../stores/userStore'

const router = useRouter()
const initiativeStore = useInitiativeStore()
const userStore = useUserStore()

// Variabile reattiva che contiene i dati del form
const form = ref({
  title: '',
  description: '',
  place: '',
  category: 'Ambiente' // Valore di default
})

const submitProposal = () => {
  if (!form.value.title || !form.value.description) {
    alert("Compila i campi obbligatori")
    return
  }

  // Chiamiamo l'azione dello store
  initiativeStore.createInitiative(form.value, userStore.user)

  alert("Iniziativa creata con successo!")

  // Rimandiamo l'utente alla Home per vedere la sua iniziativa
  router.push('/')
}
</script>

<template>
  <div class="form-container">
    <h1>Nuova Iniziativa</h1>
    <p>Proponi un cambiamento per il Comune di Trento.</p>

    <form @submit.prevent="submitProposal">

      <div class="form-group">
        <label>Titolo (Obbligatorio)</label>
        <input v-model="form.title" type="text" placeholder="Es. Nuovi cestini in centro">
      </div>

      <div class="form-group">
        <label>Luogo</label>
        <input v-model="form.place" type="text" placeholder="Es. Piazza Duomo">
      </div>

      <div class="form-group">
        <label>Categoria</label>
        <select v-model="form.category">
          <option>Ambiente</option>
          <option>Mobilità</option>
          <option>Cultura</option>
          <option>Sicurezza</option>
        </select>
      </div>

      <div class="form-group">
        <label>Descrizione (Obbligatoria)</label>
        <textarea v-model="form.description" rows="5"></textarea>
      </div>

      <button type="submit" class="submit-btn">Pubblica Iniziativa</button>
    </form>
  </div>
</template>

<style scoped>
.form-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
}

input,
textarea,
select {
  padding: 8px;
  margin-top: 5px;
  font-size: 1em;
}

.submit-btn {
  background-color: #2c3e50;
  color: white;
  padding: 10px;
  border: none;
  cursor: pointer;
  margin-top: 10px;
}
</style>
