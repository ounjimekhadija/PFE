const { z } = require('zod');

// Schéma pour la connexion
const loginSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Schémas pour l'inscription
const baseUserSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  nom: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  prenom: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères"),
});

const registerAdminSchema = baseUserSchema.extend({
  role: z.literal('ADMINISTRATEUR'),
  nomOrganisation: z.string().optional().or(z.literal('')).nullable(),
  niveauAcces: z.string().optional().or(z.literal('')).nullable(),
});

const registerEncadrantSchema = baseUserSchema.extend({
  role: z.literal('ENCADRANT'),
  grade: z.string().optional().or(z.literal('')).nullable(),
  specialite: z.string().optional().or(z.literal('')).nullable(),
  bureau: z.string().optional().or(z.literal('')).nullable(),
});

const registerEtudiantSchema = baseUserSchema.extend({
  role: z.literal('ETUDIANT'),
  numeroEtudiant: z.string().optional().or(z.literal('')).nullable(),
  cne: z.string().optional().or(z.literal('')).nullable(),
  cin: z.string().optional().or(z.literal('')).nullable(),
  niveau: z.string().optional().or(z.literal('')).nullable(),
  filiere: z.string().optional().or(z.literal('')).nullable(),
  titreProfil: z.string().optional().or(z.literal('')).nullable(),
  competences: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  githubUrl: z.string().url().optional().or(z.literal('')).nullable(),
  linkedinUrl: z.string().url().optional().or(z.literal('')).nullable(),
  portfolioUrl: z.string().url().optional().or(z.literal('')).nullable(),
  projetId: z.string().uuid().optional().or(z.literal('')).nullable(),
});

const registerSchema = z.discriminatedUnion("role", [
  registerAdminSchema,
  registerEncadrantSchema,
  registerEtudiantSchema,
]);

module.exports = {
    loginSchema,
    registerSchema
}
