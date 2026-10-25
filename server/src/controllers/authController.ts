import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Role, Department } from '../models';
import { AuthRequest } from '../middlewares/auth';

const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_entrix_2026_change_in_production';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      include: [
        { model: Role, as: 'role' },
        { model: Department, as: 'department' }
      ]
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ success: false, error: 'Account is deactivated. Contact administrator.' });
      return;
    }

    // Compare bcrypt password
    const passwordHash = user.getDataValue('password_hash');
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const roleName = (user as any).role ? (user as any).role.name : 'STAFF_USER';

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: roleName,
        department_id: user.department_id
      },
      jwtSecret,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: roleName,
        department: (user as any).department ? (user as any).department.name : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const user = await User.findByPk(authUser.id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: Role, as: 'role' },
        { model: Department, as: 'department' }
      ]
    });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching profile.' });
  }
};
