const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file in the parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Routes
const authRoutes = require('./routes/authRoutes');
const mailRoutes = require('./routes/mailRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Autoriser uniquement le frontend
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Rate Limiter pour l'endpoint d'email
const mailLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limiter chaque IP à 100 requêtes par fenêtre
  message: 'Too many emails sent from this IP, please try again after 1 minute',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes de base
app.use('/api/auth', authRoutes);
app.use('/api/mail', mailLimiter, mailRoutes);
app.use('/api/meetings', meetingRoutes);

app.get('/', (req, res) => {
  res.send('API Backend fonctionnelle');
});

// Démarrage du serveur
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Le serveur écoute sur http://localhost:${PORT}`);
  });
}

module.exports = app;
