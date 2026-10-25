import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { RefreshToken, User, Role, Department } from '../models';
import { sequelize } from '../config/db';

export const parseDurationMs = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return val * 1000;
    case 'm':
      return val * 60 * 1000;
    case 'h':
      return val * 60 * 60 * 1000;
    case 'd':
      return val * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateAccessToken = (user: any): string => {
  const roleName = user.role ? user.role.name : 'STAFF_USER';
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_name: roleName,
      department_id: user.department_id
    },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN as any }
  );
};

export const issueRefreshToken = async (userId: string): Promise<string> => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const ttlMs = parseDurationMs(ENV.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + ttlMs);

  await RefreshToken.create({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt
  });

  return rawToken;
};

export type RefreshStatus = 'SUCCESS' | 'INVALID' | 'EXPIRED' | 'REUSE_DETECTED' | 'USER_INACTIVE';

export interface RotateResult {
  status: RefreshStatus;
  accessToken?: string;
  refreshToken?: string;
  user?: any;
}

export const rotateRefreshToken = async (rawToken: string): Promise<RotateResult> => {
  if (!rawToken || typeof rawToken !== 'string') {
    return { status: 'INVALID' };
  }

  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ where: { token_hash: tokenHash } });

  if (!record) {
    return { status: 'INVALID' };
  }

  // Reuse detection: already revoked or already replaced
  if (record.revoked_at !== null || record.replaced_by_token_hash !== null) {
    // Invalidate all active tokens for this compromised user
    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: record.user_id, revoked_at: null } }
    );
    return { status: 'REUSE_DETECTED' };
  }

  // Check expiration
  if (new Date(record.expires_at) < new Date()) {
    await record.update({ revoked_at: new Date() });
    return { status: 'EXPIRED' };
  }

  // Find user and verify active status
  const user = await User.findByPk(record.user_id, {
    include: [
      { model: Role, as: 'role' },
      { model: Department, as: 'department' }
    ]
  });

  if (!user || !user.is_active) {
    await record.update({ revoked_at: new Date() });
    return { status: 'USER_INACTIVE' };
  }

  // Generate new pair atomically
  const newRawToken = crypto.randomBytes(40).toString('hex');
  const newHash = hashToken(newRawToken);
  const ttlMs = parseDurationMs(ENV.JWT_REFRESH_EXPIRES_IN);
  const newExpiresAt = new Date(Date.now() + ttlMs);

  await sequelize.transaction(async (t) => {
    await record.update(
      {
        revoked_at: new Date(),
        replaced_by_token_hash: newHash
      },
      { transaction: t }
    );

    await RefreshToken.create(
      {
        user_id: user.id,
        token_hash: newHash,
        expires_at: newExpiresAt
      },
      { transaction: t }
    );
  });

  const accessToken = generateAccessToken(user);

  return {
    status: 'SUCCESS',
    accessToken,
    refreshToken: newRawToken,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: (user as any).role ? (user as any).role.name : 'STAFF_USER',
      department: (user as any).department ? (user as any).department.name : null
    }
  };
};

export const revokeRefreshToken = async (rawToken: string): Promise<boolean> => {
  if (!rawToken || typeof rawToken !== 'string') {
    return false;
  }
  const tokenHash = hashToken(rawToken);
  const [affectedCount] = await RefreshToken.update(
    { revoked_at: new Date() },
    { where: { token_hash: tokenHash, revoked_at: null } }
  );
  return affectedCount > 0;
};
