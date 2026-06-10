import { z } from 'zod';

// Schéma pour un Étudiant
export const studentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
});

// Schéma pour une Tâche
export const taskSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z.string().optional(),
  priority: z.enum(['Faible', 'Moyenne', 'Haute']),
  status: z.enum(['À faire', 'En cours', 'Terminé']),
  assignee: z.string().optional(), // L'ID de l'étudiant assigné
});

// Schéma pour une Itération
export const iterationSchema = z.object({
  objectives: z.string().min(10, "Les objectifs doivent contenir au moins 10 caractères"),
  startDate: z.date(),
  endDate: z.date(),
});

// Schéma pour une Réunion
export const meetingSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères"),
  date: z.date(),
  location: z.string().min(3, "Le lieu doit contenir au moins 3 caractères"),
});

// Schéma pour la connexion
export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Schémas pour l'inscription
const baseUserSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  nom: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  prenom: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères"),
});

export const registerAdminSchema = baseUserSchema.extend({
  role: z.literal('ADMINISTRATEUR'),
  nomOrganisation: z.string().optional(),
  // niveauAcces removed
});

export const registerEncadrantSchema = baseUserSchema.extend({
  role: z.literal('ENCADRANT'),
  // Removed fields: grade, specialite, bureau
});

export const registerEtudiantSchema = baseUserSchema.extend({
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
  projetId: z.string().uuid().optional().or(z.literal('')),
});

export const registerSchema = z.discriminatedUnion("role", [
  registerAdminSchema,
  registerEncadrantSchema,
  registerEtudiantSchema,
]);

// Pour l'inférence de type
export type Student = z.infer<typeof studentSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Iteration = z.infer<typeof iterationSchema>;
export type Meeting = z.infer<typeof meetingSchema>;
export type Login = z.infer<typeof loginSchema>;
export type RegisterAdmin = z.infer<typeof registerAdminSchema>;
export type RegisterEncadrant = z.infer<typeof registerEncadrantSchema>;
export type RegisterEtudiant = z.infer<typeof registerEtudiantSchema>;
