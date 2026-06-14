import { z } from 'zod';

// Schema for a Student
export const studentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Name must contain at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

// Schema for a Task
export const taskSchema = z.object({
  title: z.string().min(3, "Title must contain at least 3 characters"),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']),
  status: z.enum(['To Do', 'In Progress', 'Done']),
  assignee: z.string().optional(), // The ID of the assignéd student
});

// Schema for an Iteration
export const iterationSchema = z.object({
  objectives: z.string().min(10, "Objectives must contain at least 10 characters"),
  startDate: z.date(),
  endDate: z.date(),
});

// Schema for a Meeting
export const meetingSchema = z.object({
  title: z.string().min(5, "Title must contain at least 5 characters"),
  date: z.date(),
  location: z.string().min(3, "Location must contain at least 3 characters"),
});

// Schema for login
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Schemas for registration
const baseUserSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
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

// For type inference
export type Student = z.infer<typeof studentSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Iteration = z.infer<typeof iterationSchema>;
export type Meeting = z.infer<typeof meetingSchema>;
export type Login = z.infer<typeof loginSchema>;
export type RegisterAdmin = z.infer<typeof registerAdminSchema>;
export type RegisterEncadrant = z.infer<typeof registerEncadrantSchema>;
export type RegisterEtudiant = z.infer<typeof registerEtudiantSchema>;





