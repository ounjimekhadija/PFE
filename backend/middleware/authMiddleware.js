const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authMiddleware = (req, res, next) => {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("ERREUR FATALE: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant !");
    return res.status(500).json({ error: "Erreur de configuration serveur." });
  }

  // Récupérer le token du header d'autorisation (Bearer <token>)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Token d'accès manquant, autorisation refusée." });
  }

  supabase.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data?.user) {
        return res.status(403).json({ error: 'Token invalide ou expiré.' });
      }

      // Normaliser la forme utilisée par les routes existantes (req.user.sub)
      req.user = {
        ...data.user,
        sub: data.user.id,
      };

      return next();
    })
    .catch(() => {
      return res.status(403).json({ error: 'Token invalide ou expiré.' });
    });
};

module.exports = authMiddleware;
