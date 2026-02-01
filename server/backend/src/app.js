const express = require("express");
require('dotenv').config(); // Carica le variabili d'ambiente
const app = express();
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");

// Import Routes
const initiativeRoutes = require("./routes/initiatives");
const participatoryBudgetsRoutes = require("./routes/participatoryBudgets");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const filterRoutes = require("./routes/filters");

// 1. Middleware Base
app.use(express.json());
app.use(cors());

// 2. RATE LIMITER (Importante: skippa se siamo in test)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 500, // Aumentato a 500 per development (era 100)
  skip: (req, res) => process.env.NODE_ENV === 'test',
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// 2. File Statici (Immagini)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 3. Collegamento Rotte
app.use("/initiatives", initiativeRoutes);
app.use("/participatory-budgets", participatoryBudgetsRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/", filterRoutes);

// 4. ESPLORTAZIONE (Invece di app.listen)
module.exports = app;