const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env.local' }); // Prendre les variables de la racine du projet

// Routes
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes de base
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('API Backend fonctionnelle');
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Le serveur écoute sur http://localhost:${PORT}`);
});
