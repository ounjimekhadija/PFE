const jwt = require('jsonwebtoken');

// Le JWT secret de Supabase (vous pouvez le trouver dans Paramètres API de Supabase)
// Par défaut, nous le récupérons de l'environnement, sinon on empêche le démarrage
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

const authMiddleware = (req, res, next) => {
  if (!SUPABASE_JWT_SECRET) {
    console.error("ERREUR FATALE: SUPABASE_JWT_SECRET n'est pas défini !");
    return res.status(500).json({ error: "Erreur de configuration serveur." });
  }

  // Récupérer le token du header d'autorisation (Bearer <token>)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Token d'accès manquant, autorisation refusée." });
  }

  try {
    // Vérifier le token manuellement avec jsonwebtoken en utilisant la clé secrete
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
    
    // Attacher les informations de l'utilisateur à la requête pour les utiliser dans les routes
    req.user = decoded; // 'decoded.sub' contiendra l'ID de l'utilisateur
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token invalide ou expiré." });
  }
};

module.exports = authMiddleware;
