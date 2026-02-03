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

// 2. CORS Configuration for Production
// Allow frontend origin from environment variable or localhost for development
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));

// 3. Trust Proxy (Required for Render.com load balancer)
// This ensures express-rate-limit and other middleware get the real client IP
app.set('trust proxy', 1);

// 4. RATE LIMITER (Importante: skippa se siamo in test)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 500, // Aumentato a 500 per development (era 100)
  skip: (req, res) => process.env.NODE_ENV === 'test',
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// 2. File Statici (Immagini)
/**
 * ⚠️ WARNING - EPHEMERAL FILESYSTEM ON RENDER:
 * Render's filesystem is ephemeral. All files uploaded to /uploads will be deleted
 * on every deploy or restart. For production, consider using:
 * - AWS S3
 * - Cloudinary
 * - DigitalOcean Spaces
 * - Any other persistent storage service
 */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 3. Collegamento Rotte
app.use("/initiatives", initiativeRoutes);
app.use("/participatory-budgets", participatoryBudgetsRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/", filterRoutes);

// 4. ESPLORTAZIONE (Invece di app.listen)
module.exports = app;