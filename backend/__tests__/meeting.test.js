const request = require('supertest');

// Set dummy env variables required by middleware and server loading
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock supabase-js
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
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

// Mock emailService
const mockSendEmail = jest.fn().mockResolvedValue({ messageId: 'meeting-email-123' });
jest.mock('../services/emailService', () => ({
  sendEmail: mockSendEmail,
}));

const app = require('../server');

describe('Meetings API (/api/meetings)', () => {
  const validMeeting = {
    projectId: '4c7a6e13-6d0e-4fa0-82a1-1250cf4d9302',
    title: 'Weekly Follow-up',
    date: '2026-06-01T10:00:00Z',
    location: 'Salle de réunion A',
    agenda: 'Review sprint progress and code quality',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    const response = await request(app)
      .post('/api/meetings/schedule')
      .send(validMeeting);

    expect(response.status).toBe(401);
  });

  it('should return 400 if validation fails', async () => {
    const mockUser = { id: 'encadrant-uuid', email: 'encadrant@example.com', role: 'ENCADRANT' };
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

    const response = await request(app)
      .post('/api/meetings/schedule')
      .set('Authorization', 'Bearer valid-token')
      .send({
        ...validMeeting,
        projectId: 'invalid-uuid', // invalid UUID format
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Erreur de validation');
  });

  it('should return 403 if user is authenticated but not an ENCADRANT', async () => {
    const mockUser = { id: 'student-uuid', email: 'student@example.com', role: 'ETUDIANT' };
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

    const response = await request(app)
      .post('/api/meetings/schedule')
      .set('Authorization', 'Bearer valid-token')
      .send(validMeeting);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Seul un encadrant peut planifier');
  });

  it('should successfully schedule a meeting and send email invite if user is ENCADRANT', async () => {
    const mockUser = { id: 'encadrant-uuid', email: 'encadrant@example.com', role: 'ENCADRANT' };
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

    // Mock database insertion response for 'reunions'
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: 'meeting-uuid', ...validMeeting },
        error: null,
      }) // first single call for insertion
      .mockResolvedValueOnce({
        data: {
          utilisateurs: {
            email: 'student-lead@example.com',
            nom: 'Lead',
            prenom: 'Student',
          },
        },
        error: null,
      }); // second single call for finding project lead

    const response = await request(app)
      .post('/api/meetings/schedule')
      .set('Authorization', 'Bearer valid-token')
      .send(validMeeting);

    expect(response.status).toBe(201);
    expect(response.body.message).toContain('Réunion planifiée et invitation envoyée');
    expect(response.body.meeting).toBeDefined();

    // Verify email notification was triggered
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student-lead@example.com',
        subject: expect.stringContaining('Weekly Follow-up'),
      })
    );
  });
});
