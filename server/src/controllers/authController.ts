import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Role, Department } from '../models';
import { ENV } from '../config/env';
import { sequelize } from '../config/db';
import {
  generateAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken
} from '../services/tokenService';

// Pre-computed dummy bcrypt hash to ensure constant-time comparison for nonexistent users
const DUMMY_BCRYPT_HASH = '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [
        { model: Role, as: 'role' },
        { model: Department, as: 'department' }
      ]
    });

    if (!user) {
      // Execute constant-time dummy bcrypt check to prevent username enumeration via timing attacks
      await bcrypt.compare(String(password), DUMMY_BCRYPT_HASH);
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ success: false, error: 'Account is deactivated. Contact administrator.' });
      return;
    }

    const now = new Date();

    // Check existing lockout state before performing password verification
    if (user.locked_until && new Date(user.locked_until) > now) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((new Date(user.locked_until).getTime() - now.getTime()) / 60000)
      );
      res.status(423).json({
        success: false,
        error: `Account is temporarily locked due to repeated failed login attempts. Please try again after ${remainingMinutes} minute(s).`
      });
      return;
    }

    // Verify password hash
    const passwordHash = user.getDataValue('password_hash');
    const isMatch = await bcrypt.compare(String(password), passwordHash);

    if (!isMatch) {
      // Atomic increment and conditional lockout in PostgreSQL to prevent race conditions
      const [updatedRows]: any = await sequelize.query(
        `
        UPDATE users
        SET failed_attempts = CASE
              WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1
              ELSE failed_attempts + 1
            END,
            locked_until = CASE
              WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1 ELSE failed_attempts + 1 END) >= :maxAttempts
                THEN NOW() + (:lockoutMinutes || ' minutes')::interval
              ELSE NULL
            END,
            updated_at = NOW()
        WHERE id = :id
        RETURNING failed_attempts, locked_until;
        `,
        {
          replacements: {
            id: user.id,
            maxAttempts: ENV.LOCKOUT_MAX_ATTEMPTS,
            lockoutMinutes: ENV.LOCKOUT_DURATION_MINUTES
          }
        }
      );

      const updated = updatedRows?.[0];
      const failedAttempts = updated?.failed_attempts ?? (user.failed_attempts + 1);
      const lockedUntil = updated?.locked_until;

      if (lockedUntil && new Date(lockedUntil) > now) {
        res.status(423).json({
          success: false,
          error: `Account is temporarily locked due to repeated failed login attempts. Please try again after ${ENV.LOCKOUT_DURATION_MINUTES} minute(s).`
        });
        return;
      }

      const remainingAttempts = Math.max(0, ENV.LOCKOUT_MAX_ATTEMPTS - failedAttempts);
      res.status(401).json({
        success: false,
        error:
          remainingAttempts > 0
            ? `Invalid email or password. ${remainingAttempts} attempt(s) remaining before account lockout.`
            : 'Invalid email or password.'
      });
      return;
    }

    // Reset failed attempts atomically on successful login if previously elevated
    if (user.failed_attempts > 0 || user.locked_until !== null) {
      await User.update(
        { failed_attempts: 0, locked_until: null },
        { where: { id: user.id } }
      );
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);

    res.status(200).json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: ENV.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: (user as any).role ? (user as any).role.name : 'STAFF_USER',
        department: (user as any).department ? (user as any).department.name : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ success: false, error: 'Refresh token is required.' });
      return;
    }

    const result = await rotateRefreshToken(refresh_token);

    if (result.status === 'REUSE_DETECTED') {
      res.status(403).json({
        success: false,
        error: 'Security alert: Refresh token reuse detected. All active sessions have been revoked.'
      });
      return;
    }

    if (result.status === 'EXPIRED') {
      res.status(401).json({
        success: false,
        error: 'Refresh token has expired. Please log in again.'
      });
      return;
    }

    if (result.status === 'USER_INACTIVE' || result.status === 'INVALID' || !result.accessToken) {
      res.status(401).json({
        success: false,
        error: 'Invalid or revoked refresh token.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: 'Bearer',
      expires_in: ENV.JWT_EXPIRES_IN,
      user: result.user
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during token refresh.' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (refresh_token) {
      await revokeRefreshToken(refresh_token);
    }

    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during logout.' });
  }
};

export const unlockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, userId } = req.body;

    if (!email && !userId) {
      res.status(400).json({ success: false, error: 'Either email or userId is required.' });
      return;
    }

    const whereClause: any = {};
    if (userId) whereClause.id = userId;
    if (email) whereClause.email = String(email).trim().toLowerCase();

    const [updatedCount] = await User.update(
      { failed_attempts: 0, locked_until: null },
      { where: whereClause }
    );

    if (updatedCount === 0) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({ success: true, message: 'User account unlocked successfully.' });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during account unlock.' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const user = await User.findByPk(authUser.id, {
      attributes: ['id', 'tenant_id', 'email', 'first_name', 'last_name', 'is_active', 'failed_attempts', 'locked_until'],
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name', 'permissions'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] }
      ]
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        role: (user as any).role?.name || 'STAFF_USER',
        permissions: (user as any).role?.permissions || {},
        department: (user as any).department?.name || null
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error retrieving user profile.' });
  }
};
