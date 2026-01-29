const app = require("./app"); // Importa l'app che abbiamo appena modificato
const startScheduler = require("./cronJobs"); // Importa lo scheduler qui

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}...`);
  
  // Avvia il controllo automatico delle scadenze solo qui
  startScheduler();
});