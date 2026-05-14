const { z } = require('zod');

// Schéma pour la connexion
const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Schémas pour l'inscription
const baseUserSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
});

const registerAdminSchema = baseUserSchema.extend({
  role: z.literal('ADMINISTRATEUR'),
  nomOrganisation: z.string().optional(),
  niveauAcces: z.string().optional(),
});

const registerEncadrantSchema = baseUserSchema.extend({
  role: z.literal('ENCADRANT'),
  grade: z.string().optional(),
  specialite: z.string().optional(),
  bureau: z.string().optional(),
});

const registerEtudiantSchema = baseUserSchema.extend({
  role: z.literal('ETUDIANT'),
  numeroEtudiant: z.string().optional(),
  cne: z.string().optional(),
  cin: z.string().optional(),
  niveau: z.string().optional(),
  filiere: z.string().optional(),
  titreProfil: z.string().optional(),
  competences: z.union([z.string(), z.array(z.string())]).optional(),
  githubUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  projetId: z.string().uuid().optional(),
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
