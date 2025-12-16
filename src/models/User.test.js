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
        password: 'hashedPassword123'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError).toBeUndefined();
    });

    test('should require email', () => {
      const userData = {
        password: 'hashedPassword123'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toContain('required');
    });

    test('should require password', () => {
      const userData = {
        email: 'test@example.com'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.password).toBeDefined();
      expect(validationError.errors.password.message).toContain('required');
    });

    test('should validate email format', () => {
      const userData = {
        email: 'invalid-email',
        password: 'hashedPassword123'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toContain('valid email');
    });

    test('should set default values correctly', () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedPassword123'
      };

      const user = new User(userData);

      expect(user.subscriptionStatus).toBe('inactive');
      expect(user.currentPlan).toBe('free');
      expect(user.emailVerified).toBe(false);
      expect(user.settings).toEqual({
        notifications: true,
        theme: 'light'
      });
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    test('should validate subscription status enum', () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedPassword123',
        subscriptionStatus: 'invalid-status'
      };

      const user = new User(userData);
      const validationError = user.validateSync();

      expect(validationError.errors.subscriptionStatus).toBeDefined();
    });

    test('should accept any string for current plan (free text)', () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedPassword123',
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
        password: 'hashedPassword123'
      });
    });

    describe('comparePassword', () => {
      test('should return true for correct password', async () => {
        bcrypt.compare.mockResolvedValue(true);

        const result = await user.comparePassword('correctPassword');

        expect(bcrypt.compare).toHaveBeenCalledWith('correctPassword', 'hashedPassword123');
        expect(result).toBe(true);
      });

      test('should return false for incorrect password', async () => {
        bcrypt.compare.mockResolvedValue(false);

        const result = await user.comparePassword('wrongPassword');

        expect(bcrypt.compare).toHaveBeenCalledWith('wrongPassword', 'hashedPassword123');
        expect(result).toBe(false);
      });

      test('should handle bcrypt error', async () => {
        bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

        await expect(user.comparePassword('password')).rejects.toThrow('Bcrypt error');
      });
    });

    describe('toJSON', () => {
      test('should exclude password from JSON output', () => {
        const json = user.toJSON();

        expect(json.password).toBeUndefined();
        expect(json.email).toBe('test@example.com');
        expect(json.subscriptionStatus).toBe('inactive');
      });

      test('should include all other fields in JSON output', () => {
        user.firstName = 'John';
        user.lastName = 'Doe';
        user.stripeCustomerId = 'cus_123';

        const json = user.toJSON();

        expect(json.firstName).toBe('John');
        expect(json.lastName).toBe('Doe');
        expect(json.stripeCustomerId).toBe('cus_123');
        expect(json.password).toBeUndefined();
      });
    });
  });

  describe('Pre-save middleware', () => {
    test('should hash password before saving when password is modified', async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'plainPassword123'
      });

      // Mock the isModified method
      user.isModified = jest.fn().mockReturnValue(true);
      
      bcrypt.hash.mockResolvedValue('hashedPassword123');

      // Call the pre-save hook directly
      const preSaveHook = User.schema._pres.get('save')[0].fn;
      await preSaveHook.call(user);

      expect(bcrypt.hash).toHaveBeenCalledWith('plainPassword123', 12);
      expect(user.password).toBe('hashedPassword123');
    });

    test('should not hash password if not modified', async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'hashedPassword123'
      });

      user.isModified = jest.fn().mockReturnValue(false);

      // Call the pre-save hook directly
      const preSaveHook = User.schema._pres.get('save')[0].fn;
      await preSaveHook.call(user);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(user.password).toBe('hashedPassword123');
    });
  });

  describe('Virtual fields', () => {
    test('should have virtual for fullName', () => {
      const user = new User({
        email: 'test@example.com',
        password: 'hashedPassword123',
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(user.fullName).toBe('John Doe');
    });

    test('should handle empty names in fullName virtual', () => {
      const user = new User({
        email: 'test@example.com',
        password: 'hashedPassword123'
      });

      expect(user.fullName).toBe(' ');
    });
  });

  describe('Business logic methods', () => {
    let user;

    beforeEach(() => {
      user = new User({
        email: 'test@example.com',
        password: 'hashedPassword123',
        subscriptionStatus: 'active',
        currentPlan: 'pro'
      });
    });

    test('should determine if user has active subscription', () => {
      expect(user.hasActiveSubscription()).toBe(true);

      user.subscriptionStatus = 'cancelled';
      expect(user.hasActiveSubscription()).toBe(false);

      user.subscriptionStatus = 'past_due';
      expect(user.hasActiveSubscription()).toBe(false);
    });

    test('should determine plan level access', () => {
      user.currentPlan = 'free';
      expect(user.canAccess('basic')).toBe(false);
      expect(user.canAccess('premium')).toBe(false);

      user.currentPlan = 'creator';
      expect(user.canAccess('basic')).toBe(true);
      expect(user.canAccess('premium')).toBe(false);

      user.currentPlan = 'pro';
      expect(user.canAccess('basic')).toBe(true);
      expect(user.canAccess('premium')).toBe(true);
    });

    test('should update last login timestamp', () => {
      const beforeUpdate = user.lastLogin;
      user.updateLastLogin();
      
      expect(user.lastLogin).toBeDefined();
      expect(user.lastLogin).not.toBe(beforeUpdate);
    });

    test('should generate email verification token', () => {
      const token = user.generateEmailVerificationToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(user.emailVerificationToken).toBe(token);
      expect(user.emailVerificationExpiry).toBeDefined();
    });

    test('should verify email verification token', () => {
      const token = user.generateEmailVerificationToken();
      
      expect(user.verifyEmailToken(token)).toBe(true);
      expect(user.emailVerified).toBe(true);
      expect(user.emailVerificationToken).toBeUndefined();
      expect(user.emailVerificationExpiry).toBeUndefined();
    });

    test('should reject invalid email verification token', () => {
      user.generateEmailVerificationToken();
      
      expect(user.verifyEmailToken('invalid-token')).toBe(false);
      expect(user.emailVerified).toBe(false);
    });

    test('should reject expired email verification token', () => {
      const token = user.generateEmailVerificationToken();
      user.emailVerificationExpiry = new Date(Date.now() - 1000); // 1 second ago
      
      expect(user.verifyEmailToken(token)).toBe(false);
      expect(user.emailVerified).toBe(false);
    });
  });
});