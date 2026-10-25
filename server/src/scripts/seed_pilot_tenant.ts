/**
 * ENTRIX ERP — Pilot Tenant Provisioning Utility
 * Non-destructive script to provision an isolated, synthetic pilot customer environment.
 * Usage: npx ts-node src/scripts/seed_pilot_tenant.ts <company_name> <slug> <admin_email>
 */
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/db';
import {
  Tenant,
  User,
  Department,
  InventoryItem,
  Supplier,
  Subscription
} from '../models';

export async function provisionPilotTenant(
  companyName: string = 'Apex Precision Pilot Ltd',
  slug: string = `pilot-${Date.now().toString().slice(-4)}`,
  adminEmail: string = `admin@${slug}.local`
) {
  const transaction = await sequelize.transaction();
  try {
    console.log(`[PILOT ONBOARDING] Initializing pilot tenant: '${companyName}' (${slug})...`);

    // 1. Create Tenant
    const tenant = await Tenant.create(
      {
        name: companyName,
        slug,
        status: 'ACTIVE',
        plan: 'ENTERPRISE'
      },
      { transaction }
    );

    // 2. Provision Enterprise Trial Sponsorship (90-day pilot)
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    await Subscription.create(
      {
        tenant_id: tenant.id,
        plan_tier: 'ENTERPRISE',
        status: 'ACTIVE',
        current_period_start: now,
        current_period_end: periodEnd,
        trial_ends_at: periodEnd,
        cancel_at_period_end: false
      },
      { transaction }
    );

    // 3. Provision Core Departments
    const depts = await Department.bulkCreate(
      [
        {
          tenant_id: tenant.id,
          code: 'DEPT-ENG',
          name: 'Engineering & Manufacturing',
          quarterly_budget: 750000.00
        },
        {
          tenant_id: tenant.id,
          code: 'DEPT-PROC',
          name: 'Procurement & Logistics',
          quarterly_budget: 450000.00
        },
        {
          tenant_id: tenant.id,
          code: 'DEPT-FIN',
          name: 'Finance & Treasury',
          quarterly_budget: 300000.00
        }
      ],
      { transaction }
    );

    // 4. Create Initial Company Administrator User
    const passwordHash = await bcrypt.hash('PilotSecure@2026', 10);
    const adminUser = await User.create(
      {
        tenant_id: tenant.id,
        email: adminEmail.toLowerCase().trim(),
        password_hash: passwordHash,
        first_name: 'Pilot',
        last_name: 'Lead',
        role_id: 6, // COMPANY_ADMIN
        department_id: depts[0].id,
        is_active: true
      },
      { transaction }
    );

    // 5. Seed Synthetic Pilot Inventory Catalog
    await InventoryItem.bulkCreate(
      [
        {
          tenant_id: tenant.id,
          sku_code: 'PLT-STL-01',
          name: 'Synthetic Grade 316 Stainless Rod',
          category: 'RAW_MATERIALS',
          unit_of_measure: 'KG',
          unit_price: 320.00,
          stock_qty: 150,
          safety_stock: 30
        },
        {
          tenant_id: tenant.id,
          sku_code: 'PLT-BOLT-02',
          name: 'Industrial M8 Hex Bolts (100-pack)',
          category: 'FASTENERS',
          unit_of_measure: 'BOX',
          unit_price: 45.00,
          stock_qty: 50,
          safety_stock: 15
        }
      ],
      { transaction }
    );

    // 6. Seed Sample Qualified Supplier
    await Supplier.create(
      {
        tenant_id: tenant.id,
        code: 'SUP-PLT-01',
        name: 'Apex Industrial Pilot Vendor',
        email: 'sales@apexvendor.local',
        phone: '+91 98111 22334',
        payment_terms: 'NET30',
        rating: 4.8,
        is_active: true
      },
      { transaction }
    );

    await transaction.commit();

    console.log(`[PILOT ONBOARDING] Successfully provisioned pilot tenant:`);
    console.log(`  Tenant ID:   ${tenant.id}`);
    console.log(`  Company:     ${tenant.name}`);
    console.log(`  Admin Email: ${adminUser.email}`);
    console.log(`  Default Pwd: PilotSecure@2026`);
    console.log(`  Trial End:   ${periodEnd.toISOString()}`);

    return { tenant, adminUser };
  } catch (err) {
    await transaction.rollback();
    console.error('[PILOT ONBOARDING] Failed to provision pilot tenant:', err);
    throw err;
  }
}

// Direct execution from CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const company = args[0] || 'Horizon Fabrication Pilot';
  const slug = args[1] || `horizon-${Date.now().toString().slice(-4)}`;
  const email = args[2] || `admin@${slug}.local`;

  provisionPilotTenant(company, slug, email)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
