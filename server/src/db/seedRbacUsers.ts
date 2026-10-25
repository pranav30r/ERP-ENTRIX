import { sequelize } from '../config/db';
import { User, Role } from '../models';
import bcrypt from 'bcryptjs';

async function seedRbac() {
  await sequelize.authenticate();
  const hash = await bcrypt.hash('Admin@123', 10);

  const demoUsers = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
      email: 'hr@entrix.local',
      password_hash: hash,
      first_name: 'Sarah',
      last_name: 'Jenkins',
      role_id: 2,
      department_id: '22222222-2222-2222-2222-222222222222'
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
      email: 'finance@entrix.local',
      password_hash: hash,
      first_name: 'Rajesh',
      last_name: 'Menon',
      role_id: 3,
      department_id: '33333333-3333-3333-3333-333333333333'
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04',
      email: 'procurement@entrix.local',
      password_hash: hash,
      first_name: 'Kavita',
      last_name: 'Rao',
      role_id: 4,
      department_id: '44444444-4444-4444-4444-444444444444'
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05',
      email: 'staff@entrix.local',
      password_hash: hash,
      first_name: 'Vikram',
      last_name: 'Mehta',
      role_id: 5,
      department_id: '11111111-1111-1111-1111-111111111111'
    }
  ];

  for (const u of demoUsers) {
    const existing = await User.findOne({ where: { email: u.email } });
    if (existing) {
      existing.password_hash = hash;
      existing.role_id = u.role_id;
      await existing.save();
    } else {
      await User.create(u);
    }
  }

  console.log('[RBAC Seed] All 5 role users successfully seeded into PostgreSQL!');
  await sequelize.close();
  process.exit(0);
}

seedRbac().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
