import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface PageTestConfig {
  name: string;
  path: string;
  slug: string;
  expectedHeading: string;
  hasTable: boolean;
  interactiveActions?: (page: any) => Promise<void>;
}

const PAGES: PageTestConfig[] = [
  {
    name: 'Dashboard',
    path: '/',
    slug: 'dashboard',
    expectedHeading: 'Executive Operations Dashboard',
    hasTable: true,
    interactiveActions: async (page) => {
      // Focus search box
      const search = page.locator('input[type="search"]');
      if (await search.count()) {
        await search.fill('RAW-STL');
        await page.waitForTimeout(300);
        await search.fill('');
      }
      // Click New Requisition quick button to open modal, then close
      const newReqBtn = page.getByRole('button', { name: /New Requisition/i });
      if (await newReqBtn.count()) {
        await newReqBtn.click();
        await page.waitForTimeout(400);
        const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("✕"), button:has-text("×")').first();
        if (await cancelBtn.count()) {
          await cancelBtn.click();
        }
      }
    },
  },
  {
    name: 'Procurement',
    path: '/procurement',
    slug: 'procurement',
    expectedHeading: 'Procurement & Supplier Invoicing',
    hasTable: true,
    interactiveActions: async (page) => {
      // Click filter buttons if present
      const filterBtns = page.locator('button:has-text("All"), button:has-text("Draft"), button:has-text("Pending")');
      const count = await filterBtns.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        await filterBtns.nth(i).click();
        await page.waitForTimeout(200);
      }
      // Open New Requisition modal, then cancel
      const createBtn = page.getByRole('button', { name: /New Requisition/i }).first();
      if (await createBtn.count()) {
        await createBtn.click();
        await page.waitForTimeout(300);
        const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("✕"), button:has-text("×")').first();
        if (await closeBtn.count()) await closeBtn.click();
      }
    },
  },
  {
    name: 'Inventory Master',
    path: '/inventory',
    slug: 'inventory',
    expectedHeading: 'Inventory & SKU Master',
    hasTable: true,
    interactiveActions: async (page) => {
      // Search filter
      const search = page.getByPlaceholder('Search SKU code or description...');
      if (await search.count()) {
        await search.fill('STL');
        await page.waitForTimeout(300);
        await search.fill('');
      }
      // Stock adjustment / modal test
      const adjustBtn = page.getByRole('button', { name: /Adjust/i }).first();
      if (await adjustBtn.count()) {
        await adjustBtn.click();
        await page.waitForTimeout(300);
        const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("✕"), button:has-text("×")').first();
        if (await cancelBtn.count()) await cancelBtn.click();
      }
    },
  },
  {
    name: 'Finance & Ledger',
    path: '/finance',
    slug: 'finance',
    expectedHeading: 'Finance & General Ledger',
    hasTable: true,
    interactiveActions: async (page) => {
      // Click Receivables tab then General Ledger tab
      const arTab = page.locator('button:has-text("Accounts Receivable")');
      if (await arTab.count()) {
        await arTab.click();
        await page.waitForTimeout(400);
      }
      const glTab = page.locator('button:has-text("General Ledger")');
      if (await glTab.count()) {
        await glTab.click();
        await page.waitForTimeout(400);
      }
    },
  },
  {
    name: 'Human Resources',
    path: '/hr',
    slug: 'hr',
    expectedHeading: 'Human Resource Management',
    hasTable: true,
    interactiveActions: async (page) => {
      const refreshBtn = page.getByRole('button', { name: /Refresh/i });
      if (await refreshBtn.count()) {
        await refreshBtn.click();
        await page.waitForTimeout(300);
      }
    },
  },
  {
    name: 'Project Milestones',
    path: '/projects',
    slug: 'projects',
    expectedHeading: 'Project Milestones & Resource Operations',
    hasTable: false,
    interactiveActions: async (page) => {
      // Open New Project modal and cancel
      const newProjBtn = page.getByRole('button', { name: /New Project/i });
      if (await newProjBtn.count()) {
        await newProjBtn.click();
        await page.waitForTimeout(300);
        const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("✕"), button:has-text("×")').first();
        if (await cancelBtn.count()) await cancelBtn.click();
      }
    },
  },
  {
    name: 'AI Decision Suite',
    path: '/ai-insights',
    slug: 'ai-insights',
    expectedHeading: 'AI Decision Intelligence Suite',
    hasTable: false,
    interactiveActions: async (page) => {
      const forecastHeading = page.locator('h3:has-text("Demand Curve Prediction")');
      await expect(forecastHeading).toBeVisible();
    },
  },
  {
    name: 'Audit Logs',
    path: '/audit',
    slug: 'audit',
    expectedHeading: 'Tamper-evident activity log',
    hasTable: true,
    interactiveActions: async (page) => {
      const refreshBtn = page.getByRole('button', { name: /Re-verify Chain/i });
      if (await refreshBtn.count()) {
        await refreshBtn.click();
        await page.waitForTimeout(300);
      }
    },
  },
  {
    name: 'Organization',
    path: '/settings/company',
    slug: 'organization',
    expectedHeading: 'Organization Settings',
    hasTable: true,
    interactiveActions: async (page) => {
      // Test opening Deactivate Modal (destructive action via IconButton) and cancel without confirming
      const deactBtn = page.locator('button[aria-label*="Deactivate"]').first();
      if (await deactBtn.count()) {
        await deactBtn.click();
        await page.waitForTimeout(300);
        // Verify modal appeared
        const modal = page.locator('role=dialog');
        await expect(modal).toBeVisible();
        // Cancel without confirming
        const cancelBtn = modal.locator('button:has-text("Cancel")');
        if (await cancelBtn.count()) {
          await cancelBtn.click();
        }
      }
      // Test invite modal open and close
      const inviteBtn = page.getByRole('button', { name: /Invite Team Member/i });
      if (await inviteBtn.count()) {
        await inviteBtn.click();
        await page.waitForTimeout(300);
        const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("✕"), button:has-text("×")').first();
        if (await closeBtn.count()) await closeBtn.click();
      }
    },
  },
  {
    name: 'Plans & Billing',
    path: '/settings/billing',
    slug: 'billing',
    expectedHeading: 'Plans & Monetization Management',
    hasTable: true,
    interactiveActions: async (page) => {
      // Inspect plan switch buttons
      const planBtns = page.locator('button:has-text("Upgrade to"), button:has-text("Downgrade to"), button:has-text("Current Plan")');
      expect(await planBtns.count()).toBeGreaterThanOrEqual(1);
    },
  },
];

let globalAuthToken: string = '';
let globalAuthUser: any = null;

test.describe('ENTRIX ERP End-to-End Comprehensive Audit', () => {
  test.beforeAll(async () => {
    // Obtain token once for the entire suite to avoid auth rate-limiting
    const res = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@entrix.local', password: 'Admin@123' }),
    });
    const data = await res.json();
    globalAuthToken = data.access_token;
    globalAuthUser = data.user;
  });

  test.beforeEach(async ({ page }) => {
    // Inject token before loading application
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('entrix_token', token);
      localStorage.setItem('entrix_user', JSON.stringify(user));
    }, { token: globalAuthToken, user: globalAuthUser });
  });

  for (const pageConfig of PAGES) {
    test(`Verify ${pageConfig.name} (${pageConfig.path})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const failedRequests: { url: string; status: number }[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('response', (res) => {
        if (res.status() >= 400 && !res.url().includes('favicon')) {
          failedRequests.push({ url: res.url(), status: res.status() });
        }
      });

      // 1. Visit Page
      await page.goto(pageConfig.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      // 2. Assert page heading is visible
      const heading = page.locator('h1, h2, h3').filter({ hasText: pageConfig.expectedHeading }).first();
      await expect(heading).toBeVisible();

      // 3. Table verification (if applicable)
      if (pageConfig.hasTable) {
        const table = page.locator('table');
        if (await table.count()) {
          const rows = table.locator('tbody tr');
          const rowCount = await rows.count();
          expect(rowCount).toBeGreaterThanOrEqual(1);
        }
      }

      // 4. Assert no text contains "Invalid Date" or "NaN"
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('Invalid Date');
      expect(bodyText).not.toMatch(/\bNaN\b/);

      // 5. Run page interactive actions
      if (pageConfig.interactiveActions) {
        await pageConfig.interactiveActions(page);
      }

      // 6. Test Responsive Layouts at 1024px and 768px
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(200);

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(200);

      // Reset to Desktop view for screenshot
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(400);

      // 7. Save Screenshot
      const screenshotDir = path.resolve('e2e/screenshots');
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotPath = path.join(screenshotDir, `${pageConfig.slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Also copy to brain artifact directory for display
      const brainDir = path.resolve('C:/Users/prana/.gemini/antigravity/brain/9f09775e-c434-482c-93bf-32308602f815/screenshots');
      if (fs.existsSync(brainDir)) {
        fs.copyFileSync(screenshotPath, path.join(brainDir, `${pageConfig.slug}.png`));
      }

      // Assert no console errors or failed network requests
      expect(consoleErrors, `Console errors detected on ${pageConfig.name}: ${consoleErrors.join('; ')}`).toHaveLength(0);
      expect(failedRequests, `Failed network requests on ${pageConfig.name}: ${JSON.stringify(failedRequests)}`).toHaveLength(0);
    });
  }
});
