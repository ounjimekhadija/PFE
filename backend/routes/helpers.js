const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

const tryInsertRoleRow = async (tableName, userId, role, payload) => {
    const candidates = buildRoleInsertCandidates(role, userId, payload);

    let lastError = null;

    for (const row of candidates) {
        const { error } = await supabase.from(tableName).insert(row);
        if (!error) {
            return { ok: true, usedPayload: row };
        }
        lastError = error;
    }

    console.error(
        `Échec de l'insertion dans la table ${tableName} pour l'utilisateur ${userId}`,
        lastError
    );

    return { ok: false, error: lastError };
};

module.exports = {
    tryInsertRoleRow,
    toNullable,
    toSkillsArray,
    buildRoleInsertCandidates,
};
