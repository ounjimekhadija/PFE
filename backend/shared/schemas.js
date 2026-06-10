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
  // niveauAcces removed
});

const registerEncadrantSchema = baseUserSchema.extend({
  role: z.literal('ENCADRANT'),
  // grade, specialite and bureau removed
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

const meetingSchema = z.object({
  projectId: z.string().uuid("ID de projet invalide"),
  title: z.string().trim().min(3, "Le titre doit faire au moins 3 caractères"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Date invalide",
  }),
  location: z.string().trim().min(2, "Le lieu doit faire au moins 2 caractères"),
  agenda: z.string().trim().min(3, "L'ordre du jour doit faire au moins 3 caractères"),
});

module.exports = {
    loginSchema,
    registerSchema,
    meetingSchema
}
