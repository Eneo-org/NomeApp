const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const initiativeRoutes = require("./routes/initiatives");
const participatoryBudgetsRoutes = require("./routes/participatoryBudgets");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const filterRoutes = require("./routes/filters");

app.use(express.json());
app.use(cors());

// --- FIX PER LE IMMAGINI ---
// __dirname è "server/backend/src"
// Noi dobbiamo puntare a "server/backend/uploads" (un livello sopra)
// Usiamo path.join con '../uploads'
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Se per caso avessi vecchi file dentro src/uploads, puoi decommentare questa riga per servire anche quelli:
// app.use('/src/uploads', express.static(path.join(__dirname, 'uploads')));

// Collega le rotte
app.use("/initiatives", initiativeRoutes);
app.use("/participatory-budgets", participatoryBudgetsRoutes);

app.use("/auth", authRoutes);
app.use("/users", userRoutes);

app.use("/", filterRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server attivo sulla porta ${port}...`));
