const request = require('supertest');

// Set dummy env variables required by middleware and server loading
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock supabase-js
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    admin: {
      createUser: jest.fn(),
      deleteUser: jest.fn(),
    }
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

const app = require('../server');

describe('Auth API (/api/auth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/me (User Profile)', () => {
    it('should return 401 if Authorization header is missing', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Token d'accès manquant");
    });

    it('should return 403 if token is invalid or expired', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: null, error: new Error('Invalid token') });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Token invalide ou expiré');
    });

    it('should return 200 and user info if token is valid', async () => {
      const mockUser = { id: 'user-uuid', email: 'test@example.com', role: 'ETUDIANT' };
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

      // Mock database fetch for the user
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'user-uuid',
          email: 'test@example.com',
          role: 'ETUDIANT',
          nom: 'Doe',
          prenom: 'John'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authentification réussie');
      expect(response.body.user).toEqual({
        id: 'user-uuid',
        email: 'test@example.com',
        role: 'ETUDIANT',
        nom: 'Doe',
        prenom: 'John'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if validation fails (invalid email/short password)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Erreur de validation');
      expect(response.body.errors).toBeDefined();
    });

    it('should login successfully with valid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: 'jwt-token' },
          user: { id: 'user-uuid', email: 'test@example.com' }
        },
        error: null
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Connexion réussie');
      expect(response.body.session).toBeDefined();
      expect(response.body.user).toBeDefined();
    });

    it('should return 401 if credentials are wrong', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error('Invalid login credentials')
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid login credentials');
    });
  });
});
