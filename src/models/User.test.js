const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./User');

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema validation', () => {
    test('should be valid with required fields', () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedPassword123'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError).toBeUndefined();
    });

    test('should require email', () => {
      const userData = {
        passwordHash: 'hashedPassword123'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toContain('required');
    });

    test('should require passwordHash when no clerkUserId', () => {
      const userData = {
        email: 'test@example.com'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.passwordHash).toBeDefined();
    });

    test('should not require passwordHash when clerkUserId is present', () => {
      const userData = {
        email: 'test@example.com',
        clerkUserId: 'clerk_123'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError).toBeUndefined();
    });

    test('should set default values correctly', () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedPassword123'
      };

      const user = new User(userData);

      expect(user.subscriptionStatus).toBe('none');
      expect(user.currentPlan).toBe('free');
      expect(user.role).toBe('user');
    });

    test('should validate subscription status enum', () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedPassword123',
        subscriptionStatus: 'invalid-status'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.subscriptionStatus).toBeDefined();
    });

    test('should accept any string for current plan (free text)', () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedPassword123',
        currentPlan: 'custom-enterprise-plan'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError).toBeUndefined();
      expect(user.currentPlan).toBe('custom-enterprise-plan');
    });
  });

  describe('Instance methods', () => {
    let user;

    beforeEach(() => {
      user = new User({
        email: 'test@example.com',
        passwordHash: 'hashedPassword123'
      });
    });

    test('should compare password correctly', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const result = await user.comparePassword('correctPassword');

      expect(bcrypt.compare).toHaveBeenCalledWith('correctPassword', 'hashedPassword123');
      expect(result).toBe(true);
    });

    test('should return false for incorrect password', async () => {
      bcrypt.compare.mockResolvedValue(false);

      const result = await user.comparePassword('wrongPassword');

      expect(result).toBe(false);
    });

    test('should handle bcrypt error', async () => {
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      await expect(user.comparePassword('password')).rejects.toThrow('Bcrypt error');
    });

    test('should exclude passwordHash from JSON output', () => {
      const json = user.toJSON();

      expect(json.passwordHash).toBeUndefined();
      expect(json.__v).toBeUndefined();
      expect(json.email).toBe('test@example.com');
    });
  });
});