const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { meetingSchema } = require('../shared/schemas');
const { sendEmail } = require('../services/emailService');

// Initialisation du client Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Route pour planifier une réunion et envoyer une notification
router.post('/schedule', authMiddleware, validate({ body: meetingSchema }), async (req, res) => {
  try {
    const { projectId, title, date, location, agenda } = req.body;
    const encadrantId = req.user.sub;

    // 1. Vérifier que l'utilisateur est bien un encadrant
    if (req.user.role !== 'ENCADRANT') {
      return res.status(403).json({ error: "Seul un encadrant peut planifier une réunion." });
    }

    // 2. Enregistrer la réunion dans la base de données
    const { data: meetingData, error: meetingError } = await supabase
      .from('reunions')
      .insert({
        projet_id: projectId,
        encadrant_id: encadrantId,
        titre: title,
        date_heure: date,
        lieu: location,
        ordre_du_jour: agenda,
      })
      .select()
      .single();

    if (meetingError) {
      console.error("Erreur lors de l'enregistrement de la réunion:", meetingError);
      return res.status(500).json({ error: "Impossible d'enregistrer la réunion." });
    }

    // 3. Trouver le chef de projet et son email
    const { data: projectLead, error: leadError } = await supabase
      .from('etudiants')
      .select('utilisateurs ( email, nom, prenom )')
      .eq('projet_id', projectId)
      .eq('est_chef', true)
      .single();

    if (leadError || !projectLead) {
      console.error("Erreur: Impossible de trouver le chef du projet:", leadError);
      // On ne bloque pas le processus, la réunion est créée mais l'email n'est pas envoyé.
      return res.status(201).json({ 
        message: "Réunion planifiée avec succès, mais l'email d'invitation n'a pas pu être envoyé (chef de projet introuvable).",
        meeting: meetingData 
      });
    }

    const leadUser = Array.isArray(projectLead.utilisateurs) ? projectLead.utilisateurs[0] : projectLead.utilisateurs;
    const toEmail = leadUser.email;
    const leadName = `${leadUser.prenom} ${leadUser.nom}`;

    // 4. Envoyer l'email de notification
    await sendEmail({
      to: toEmail,
      subject: `Invitation à une réunion : ${title}`,
      text: `Bonjour ${leadName},\n\nVous êtes invité à une réunion de suivi.\n\n- Date et Heure : ${new Date(date).toLocaleString('fr-FR')}\n- Lieu : ${location}\n- Ordre du jour : ${agenda}\n\nCordialement,\nVotre encadrant.`,
      html: `<p>Bonjour ${leadName},</p><p>Vous êtes invité à une réunion de suivi.</p><ul><li><strong>Date et Heure :</strong> ${new Date(date).toLocaleString('fr-FR')}</li><li><strong>Lieu :</strong> ${location}</li><li><strong>Ordre du jour :</strong> ${agenda}</li></ul><p>Cordialement,<br>Votre encadrant.</p>`,
    });

    res.status(201).json({ message: 'Réunion planifiée et invitation envoyée avec succès.', meeting: meetingData });

  } catch (error) {
    console.error('Erreur sur la route /schedule-meeting:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
