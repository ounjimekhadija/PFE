const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createClient } = require('@supabase/supabase-js');

// On instancie un client Supabase avec la clé secrete du service (backend uniquement)
// pour pourvoir interroger la base sans dépendre de l'authentification client.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Route API : "Qui suis-je ?"
// Elle demande un token valide via le middleware
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub; // sub contient l'UUID de l'utilisateur

    // Interroger la table utilisateurs avec cet ID
    const { data: user, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: "Utilisateur introuvable dans la base" });
    }

    res.json({
      message: "Authentification réussie",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom
      }
    });

  } catch (error) {
    res.status(500).json({ error: "Erreur serveur HTTP" });
  }
});

module.exports = router;
