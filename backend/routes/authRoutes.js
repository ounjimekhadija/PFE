const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { loginSchema, registerSchema } = require('../shared/schemas');
const { createClient } = require('@supabase/supabase-js');
const { tryInsertRoleRow } = require('./helpers');

// On instancie un client Supabase avec la clé secrete du service (backend uniquement)
// pour pourvoir interroger la base sans dépendre de l'authentification client.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_ROLES = ['ADMINISTRATEUR', 'ENCADRANT', 'ETUDIANT'];

const ROLE_TABLE_BY_ROLE = {
  ADMINISTRATEUR: 'administrateurs',
  ENCADRANT: 'encadrants',
  ETUDIANT: 'etudiants',
};

const toNullable = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const toSkillsArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const getAdminFromToken = async (userId) => {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  if (data.role !== 'ADMINISTRATEUR') return null;
  return data;
};

const buildRoleInsertCandidates = (role, userId, payload) => {
  if (role === 'ADMINISTRATEUR') {
    const base = {
      nom_organisation: toNullable(payload.nomOrganisation) || 'Organisation',
      niveau_acces: toNullable(payload.niveauAcces) || 'ADMIN',
    };

    return [
      { id: userId, ...base },
      { utilisateur_id: userId, ...base },
      { id: userId, utilisateur_id: userId, ...base },
      { ...base },
    ];
  }

  if (role === 'ENCADRANT') {
    const base = {
      grade: toNullable(payload.grade) || 'Professeur',
      specialite: toNullable(payload.specialite) || 'Informatique',
      bureau: toNullable(payload.bureau) || 'N/A',
    };

    return [
      { id: userId, utilisateur_id: userId, ...base },
      { id: userId, ...base },
      { utilisateur_id: userId, ...base },
      { user_id: userId, ...base },
      { auth_user_id: userId, ...base },
      { ...base },
    ];
  }

  const etudiantBase = {
    numero_etudiant: toNullable(payload.numeroEtudiant),
    cne: toNullable(payload.cne),
    cin: toNullable(payload.cin),
    niveau: toNullable(payload.niveau),
    filiere: toNullable(payload.filiere),
    titre_profil: toNullable(payload.titreProfil),
    competences: toSkillsArray(payload.competences),
    github_url: toNullable(payload.githubUrl),
    linkedin_url: toNullable(payload.linkedinUrl),
    portfolio_url: toNullable(payload.portfolioUrl),
    projet_id: toNullable(payload.projetId),
  };

  return [
    { id: userId, ...etudiantBase },
    { utilisateur_id: userId, ...etudiantBase },
    { user_id: userId, ...etudiantBase },
    { auth_user_id: userId, ...etudiantBase },
    { ...etudiantBase },
  ];
};



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

// Route API admin : creer un utilisateur
// 1) cree auth.users
// 2) insere dans utilisateurs
// 3) insere dans table de role (administrateurs | encadrants | etudiants)
router.post('/admin/users', authMiddleware, validate({ body: registerSchema }), async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant.' });
    }

    const requesterId = req.user?.sub;
    if (!requesterId) {
      return res.status(401).json({ error: 'Token invalide: utilisateur introuvable.' });
    }

    const admin = await getAdminFromToken(requesterId);
    if (!admin) {
      return res.status(403).json({ error: 'Acces refuse: role administrateur requis.' });
    }

    const email = toNullable(req.body?.email)?.toLowerCase();
    const password = toNullable(req.body?.password);
    const nom = toNullable(req.body?.nom);
    const prenom = toNullable(req.body?.prenom);
    const telephone = toNullable(req.body?.telephone);
    const role = toNullable(req.body?.role);
    const filiere = toNullable(req.body?.filiere);
    const projetId = toNullable(req.body?.projetId);
    const nomOrganisation = toNullable(req.body?.nomOrganisation);
    const niveauAcces = toNullable(req.body?.niveauAcces);
    const grade = toNullable(req.body?.grade);
    const specialite = toNullable(req.body?.specialite);
    const bureau = toNullable(req.body?.bureau);
    const numeroEtudiant = toNullable(req.body?.numeroEtudiant);
    const cne = toNullable(req.body?.cne);
    const cin = toNullable(req.body?.cin);
    const niveau = toNullable(req.body?.niveau);
    const titreProfil = toNullable(req.body?.titreProfil);
    const competences = req.body?.competences;
    const githubUrl = toNullable(req.body?.githubUrl);
    const linkedinUrl = toNullable(req.body?.linkedinUrl);
    const portfolioUrl = toNullable(req.body?.portfolioUrl);

    if (!email || !password || !nom || !prenom || !role) {
      return res.status(400).json({
        error: 'Champs requis: email, password, nom, prenom, role.',
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Role invalide. Roles autorises: ${VALID_ROLES.join(', ')}`,
      });
    }

    if (role === 'ADMINISTRATEUR' && (!nomOrganisation || !niveauAcces)) {
      return res.status(400).json({
        error: 'Pour ADMINISTRATEUR, nomOrganisation et niveauAcces sont requis.',
      });
    }

    if (role === 'ENCADRANT' && (!grade || !specialite || !bureau)) {
      return res.status(400).json({
        error: 'Pour ENCADRANT, grade, specialite et bureau sont requis.',
      });
    }

    if (role === 'ETUDIANT' && !numeroEtudiant) {
      return res.status(400).json({
        error: 'Pour ETUDIANT, numeroEtudiant est requis.',
      });
    }

    const roleTable = ROLE_TABLE_BY_ROLE[role];

    const { data: createdAuthUser, error: authCreateError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nom,
        prenom,
        role,
      },
    });

    if (authCreateError || !createdAuthUser?.user?.id) {
      return res.status(400).json({
        error: authCreateError?.message || 'Creation auth.users echouee.',
      });
    }

    const newUserId = createdAuthUser.user.id;

    const { error: userInsertError } = await supabase
      .from('utilisateurs')
      .upsert({
        id: newUserId,
        email,
        nom,
        prenom,
        telephone,
        role,
      }, { onConflict: 'id' });

    if (userInsertError) {
      await supabase.auth.admin.deleteUser(newUserId);
      return res.status(400).json({
        error: `Insertion dans utilisateurs echouee: ${userInsertError.message}`,
      });
    }

    const roleInsert = await tryInsertRoleRow(roleTable, newUserId, role, {
      nomOrganisation,
      niveauAcces,
      grade,
      specialite,
      bureau,
      numeroEtudiant,
      cne,
      cin,
      niveau,
      filiere,
      titreProfil,
      competences,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      projetId,
    });

    if (!roleInsert.ok) {
      await supabase.from('utilisateurs').delete().eq('id', newUserId);
      await supabase.auth.admin.deleteUser(newUserId);

      return res.status(400).json({
        error: `Insertion dans ${roleTable} echouee: ${roleInsert.error?.message || 'Erreur inconnue'}`,
        details: roleInsert.error,
      });
    }

    return res.status(201).json({
      message: 'Utilisateur cree avec succes.',
      user: {
        id: newUserId,
        email,
        nom,
        prenom,
        role,
      },
    });
  } catch (error) {
    console.error('Erreur creation utilisateur admin:', error);
    return res.status(500).json({
      error: 'Erreur serveur lors de la creation utilisateur.',
    });
  }
});

// Route API admin : creer un projet
router.post('/admin/projects', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user?.sub;
    if (!requesterId) return res.status(401).json({ error: 'Token invalide.' });

    const admin = await getAdminFromToken(requesterId);
    if (!admin) return res.status(403).json({ error: 'Acces refuse: role administrateur requis.' });

    const titre = toNullable(req.body?.titre);
    if (!titre) return res.status(400).json({ error: 'Le titre du projet est requis.' });

    const { data, error } = await supabase
      .from('projets')
      .insert({
        titre,
        domaine: toNullable(req.body?.domaine),
        encadrant_id: toNullable(req.body?.encadrantId),
        nom_groupe: toNullable(req.body?.nomGroupe),
        deadline_globale: toNullable(req.body?.deadline),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Create notification for admins
    await supabase.from('notifications').insert({
      title: 'Nouveau Groupe',
      message: `Le groupe "${titre}" a été créé.`,
      type: 'PROJECT_CREATED'
    });

    return res.status(201).json({ message: 'Projet cree avec succes.', project: data });
  } catch (err) {
    console.error('Erreur creation projet:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la creation du projet.' });
  }
});

// Route API admin : supprimer un projet
router.delete('/admin/projects/:id', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user?.sub;
    if (!requesterId) return res.status(401).json({ error: 'Token invalide.' });

    const admin = await getAdminFromToken(requesterId);
    if (!admin) return res.status(403).json({ error: 'Acces refuse: role administrateur requis.' });

    const projectId = req.params.id;
    if (!projectId) return res.status(400).json({ error: 'ID projet requis.' });

    // Detach students from project
    await supabase.from('etudiants').update({ projet_id: null }).eq('projet_id', projectId);

    // Delete tasks then iterations
    const { data: iterations } = await supabase
      .from('iterations')
      .select('id')
      .eq('projet_id', projectId);

    if (iterations && iterations.length > 0) {
      const iterationIds = iterations.map((it) => it.id);
      await supabase.from('taches').delete().in('iteration_id', iterationIds);
      await supabase.from('iterations').delete().eq('projet_id', projectId);
    }

    // Delete messages linked to project
    await supabase.from('messages').delete().eq('projet_id', projectId);

    const { error } = await supabase.from('projets').delete().eq('id', projectId);
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ message: 'Projet supprime avec succes.' });
  } catch (err) {
    console.error('Erreur suppression projet:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la suppression du projet.' });
  }
});

// Route API admin : supprimer un utilisateur
// 1) supprime dans la table de role (administrateurs | encadrants | etudiants)
// 2) supprime dans utilisateurs
// 3) supprime dans auth.users
router.delete('/admin/users/:id', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user?.sub;
    if (!requesterId) {
      return res.status(401).json({ error: 'Token invalide: utilisateur introuvable.' });
    }

    const admin = await getAdminFromToken(requesterId);
    if (!admin) {
      return res.status(403).json({ error: 'Acces refuse: role administrateur requis.' });
    }

    const targetId = req.params.id;
    if (!targetId) {
      return res.status(400).json({ error: 'ID utilisateur requis.' });
    }

    if (targetId === requesterId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    const { data: targetUser, error: fetchError } = await supabase
      .from('utilisateurs')
      .select('id, role')
      .eq('id', targetId)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Collect all IDs linked to this user across every role table
    const allLinkedIds = new Set([targetId]);
    for (const table of ['etudiants', 'encadrants', 'administrateurs']) {
      const linkCols = ['id', 'utilisateur_id', 'user_id', 'auth_user_id'];
      for (const col of linkCols) {
        const { data } = await supabase.from(table).select('id').eq(col, targetId);
        if (Array.isArray(data)) data.forEach((r) => r?.id && allLinkedIds.add(String(r.id)));
      }
    }

    const idsArray = Array.from(allLinkedIds);

    // Nullify taches.assigne_id for every possible ID before any deletion
    await supabase.from('taches').update({ assigne_id: null }).in('assigne_id', idsArray);

    // Remove messages and comments authored by this user
    await supabase.from('messages').delete().in('expediteur_id', idsArray);
    await supabase.from('commentaires').delete().in('auteur_id', idsArray);

    // Delete from every role table using all known link columns
    for (const table of ['etudiants', 'encadrants', 'administrateurs']) {
      for (const col of ['id', 'utilisateur_id', 'user_id', 'auth_user_id']) {
        await supabase.from(table).delete().eq(col, targetId);
      }
    }

    const { error: deleteUserError } = await supabase
      .from('utilisateurs')
      .delete()
      .eq('id', targetId);

    if (deleteUserError) {
      return res.status(400).json({ error: `Erreur suppression utilisateur: ${deleteUserError.message}` });
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(targetId);
    if (deleteAuthError) {
      return res.status(400).json({ error: `Erreur suppression auth: ${deleteAuthError.message}` });
    }

    return res.status(200).json({ message: 'Utilisateur supprime avec succes.' });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
  }
});

// Route API : "Inscription"
// Elle demande un token valide via le middleware
router.post('/register', validate({ body: registerSchema }), async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant.' });
    }

    const { email, password } = req.body;

    const { data: newUser, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom,
          prenom,
          role,
          telephone,
        },
      },
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }

    const userId = newUser?.user?.id;
    if (!userId) {
      return res.status(500).json({ error: 'Erreur lors de la création de l’utilisateur.' });
    }

    const roleTableName = ROLE_TABLE_BY_ROLE[role];
    if (!roleTableName) {
      return res.status(400).json({ error: `Role invalide: ${role}` });
    }

    const { ok, error: insertError } = await tryInsertRoleRow(
      roleTableName,
      userId,
      role,
      req.body
    );

    if (!ok) {
      // Si l'insertion dans la table de rôle échoue, on supprime l'utilisateur créé
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: `Erreur lors de l'insertion dans la table ${roleTableName}: ${insertError.message}`,
      });
    }

    res.status(201).json({ message: 'Utilisateur créé avec succès', userId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route API : "Connexion"
// Elle demande un token valide via le middleware
router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  res.json({
    message: 'Connexion réussie',
    session: data.session,
    user: data.user,
  });
});

module.exports = router;
