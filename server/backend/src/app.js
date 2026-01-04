const express = require('express');
const app = express();
const cors = require('cors'); // Utile se il frontend gira su una porta diversa
const path = require('path'); //per gestire le immagini ed i file
const initiativeRoutes = require('./routes/initiatives');
const participatoryBudgetsRoutes = require('./routes/participatoryBudgets');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const filterRoutes = require('./routes/filters');

app.use(express.json());
app.use(cors());

// --- Esposizione Cartella Uploads ---
// Questo rende accessibile via browser tutto ciò che c'è dentro /uploads.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Collega le rotte
app.use('/initiatives', initiativeRoutes); 
app.use('/participatory-budgets', participatoryBudgetsRoutes);

app.use('/auth', authRoutes);   
app.use('/users', userRoutes);  

app.use('/', filterRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server attivo sulla porta ${port}...`));