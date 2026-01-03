<script setup>
// Logica futura per il form
</script>

<template>
  <div class="create-container">
    <h1>Crea Nuova Iniziativa</h1>
    <p>🚧 Questa sezione è in costruzione.</p>
    <p>Qui i cittadini potranno compilare il modulo per proporre nuove idee.</p>

    <RouterLink to="/">
      <button class="back-btn">← Torna alla Home</button>
    </RouterLink>
  </div>
</template>

<style scoped>
.create-container {
  max-width: 800px;
  margin: 40px auto;
  padding: 40px;
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  color: var(--text-color);
  text-align: center;
  box-shadow: var(--card-shadow);
}

h1 {
  color: var(--accent-color);
  margin-bottom: 20px;
}

p {
  color: var(--secondary-text);
  margin-bottom: 30px;
  font-size: 1.1rem;
}

.back-btn {
  background-color: var(--input-bg);
  border: 1px solid var(--header-border);
  color: var(--text-color);
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.back-btn:hover {
  background-color: var(--card-border);
}
</style>
