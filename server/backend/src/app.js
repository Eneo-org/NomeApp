const express = require('express');
const app = express();
const cors = require('cors'); // Utile se il frontend gira su una porta diversa
const initiativeRoutes = require('./routes/initiatives');

app.use(express.json());
app.use(cors());

// Collega le rotte
// Tutte le chiamate che iniziano con /initiatives andranno al file delle rotte iniziative
app.use('/initiatives', initiativeRoutes); 

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server attivo sulla porta ${port}...`));