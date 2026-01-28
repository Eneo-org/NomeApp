const express = require("express");
require('dotenv').config(); // Carica le variabili d'ambiente
const app = express();
const cors = require("cors");
const path = require("path");

// Import Routes
const initiativeRoutes = require("./routes/initiatives");
const participatoryBudgetsRoutes = require("./routes/participatoryBudgets");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const filterRoutes = require("./routes/filters");
const notificationRoutes = require("./routes/notificationRoutes");

// Import Cron Jobs
const startScheduler = require("./cronJobs");

// 1. Middleware Base
app.use(express.json());
app.use(cors());

// 2. File Statici (Immagini)
// Serve la cartella "uploads" che sta un livello sopra a "src"
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 3. Collegamento Rotte
app.use("/initiatives", initiativeRoutes);
app.use("/participatory-budgets", participatoryBudgetsRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/", filterRoutes); // Filtri generici
app.use("/notifications", notificationRoutes);

// 4. Avvio Server e Schedulatore
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}...`);

  // Avvia il controllo automatico delle scadenze solo quando il server è su
  startScheduler();
});
