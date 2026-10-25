export type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export interface PlanEntitlement {
  tier: PlanTier;
  name: string;
  tagline: string;
  priceMonthlyINR: number;
  maxUsers: number;
  maxStorageMB: number;
  maxMonthlyAiInferences: number;
  allowedModules: string[];
  features: string[];
  supportTier: string;
}

export const PLANS: Record<PlanTier, PlanEntitlement> = {
  FREE: {
    tier: 'FREE',
    name: 'Developer Free',
    tagline: 'Ideal for local prototyping and development testing',
    priceMonthlyINR: 0,
    maxUsers: 3,
    maxStorageMB: 250,
    maxMonthlyAiInferences: 0,
    allowedModules: ['DASHBOARD', 'PROCUREMENT', 'INVENTORY'],
    features: [
      'Up to 3 active users',
      'Basic inventory tracking',
      'Requisition workflow',
      'Standard community support'
    ],
    supportTier: 'Community'
  },
  STARTER: {
    tier: 'STARTER',
    name: 'Starter SME',
    tagline: 'Streamlined ERP for growing manufacturing & trade businesses',
    priceMonthlyINR: 4999,
    maxUsers: 10,
    maxStorageMB: 2048, // 2 GB
    maxMonthlyAiInferences: 50,
    allowedModules: ['DASHBOARD', 'PROCUREMENT', 'INVENTORY', 'PROJECTS'],
    features: [
      'Up to 10 active team members',
      'Project milestone burndown',
      '50 ML demand forecasts/mo',
      'Standard business hours SLA'
    ],
    supportTier: 'Standard Email (24h)'
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth Business',
    tagline: 'Full ERP automation with finance ledger & HR management',
    priceMonthlyINR: 14999,
    maxUsers: 50,
    maxStorageMB: 15360, // 15 GB
    maxMonthlyAiInferences: 500,
    allowedModules: ['DASHBOARD', 'PROCUREMENT', 'INVENTORY', 'PROJECTS', 'HR', 'FINANCE', 'AI'],
    features: [
      'Up to 50 active personnel',
      'Double-entry General Ledger',
      'Employee directory & roster',
      '500 ML inferences & anomaly alerts',
      'Priority ticket support'
    ],
    supportTier: 'Priority (4h response)'
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise Uncapped',
    tagline: 'Unlimited scale with cryptographic audit compliance',
    priceMonthlyINR: 39999,
    maxUsers: 999999,
    maxStorageMB: 102400, // 100 GB
    maxMonthlyAiInferences: 100000,
    allowedModules: ['DASHBOARD', 'PROCUREMENT', 'INVENTORY', 'PROJECTS', 'HR', 'FINANCE', 'AI', 'AUDIT'],
    features: [
      'Unlimited company users',
      'Full cryptographic SHA-256 audit logs',
      'Uncapped AI regression & anomaly engine',
      'Custom retention policies',
      'Dedicated 24/7 account manager'
    ],
    supportTier: 'Dedicated SLA (1h 24/7)'
  }
};

export const getPlanEntitlement = (tier: string): PlanEntitlement => {
  const normalized = (tier || 'STARTER').toUpperCase() as PlanTier;
  return PLANS[normalized] || PLANS.STARTER;
};
