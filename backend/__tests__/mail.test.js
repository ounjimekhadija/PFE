const request = require('supertest');
const nodemailer = require('nodemailer');

// Set dummy env variables required by middleware and server loading
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: '12345' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: (options) => mockSendMail(options),
  }),
}));

const app = require('../server');

describe('Mail API (/api/mail)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully send an email when all fields are valid', async () => {
    const response = await request(app)
      .post('/api/mail/send')
      .send({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Email sent successfully' });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: process.env.EMAIL_USER,
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Test Body',
    });
  });

  it('should return 400 if required fields are missing', async () => {
    const response = await request(app)
      .post('/api/mail/send')
      .send({
        to: 'recipient@example.com',
        // subject is missing
        text: 'Test Body',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required fields');
  });

  it('should return 500 if nodemailer transport fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Nodemailer error'));

    const response = await request(app)
      .post('/api/mail/send')
      .send({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to send email');
  });
});
