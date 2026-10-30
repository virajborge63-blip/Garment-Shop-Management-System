import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { getBusinessDate } from '../shared/businessDate.ts';
import {
  ATTENDANCE_PAGE_SIZE_DEFAULT,
  ATTENDANCE_PAGE_SIZE_MAX,
  EMPLOYEE_PAGE_SIZE_DEFAULT,
  EMPLOYEE_PAGE_SIZE_MAX,
} from '../shared/pagination.ts';

const mongo = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
});

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongo.getUri();
process.env.SESSION_SECRET = 'test-session-secret-with-more-than-thirty-two-characters';

const mongoose = (await import('mongoose')).default;
await mongoose.connect(process.env.MONGODB_URI);

const { Attendance, AuditLog, Category, Employee, InvoiceCounter, Payroll, Product, Sale, Session, Setting, User, connectDB, hashPassword } =
  await import('../server/db.ts');
const { default: authRoutes } = await import('../server/routes/authRoutes.ts');
const { default: adminRoutes } = await import('../server/routes/adminRoutes.ts');
const { default: superAdminRoutes } = await import('../server/routes/superAdminRoutes.ts');
const { default: employeeRoutes } = await import('../server/routes/employeeRoutes.ts');
const { default: shopRoutes } = await import('../server/routes/shopRoutes.ts');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/shop', shopRoutes);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const adminCredentials = {
  username: `admin-${suffix}`,
  email: `admin-${suffix}@example.test`,
  password: 'Test-password-123!',
};
const ownerCredentials = {
  username: `owner-${suffix}`,
  email: `owner-${suffix}@example.test`,
  password: 'Owner-password-123!',
};
const employeeId = `TEST-${suffix}`.toUpperCase();
const employeeCredentials = {
  username: `employee-${suffix}`,
  email: `employee-${suffix}@example.test`,
  password: 'Employee-password-123!',
};
let adminToken = '';
let ownerToken = '';
let employeeToken = '';

async function login(username: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ identifier: username, password });

  expect(response.status).toBe(200);
  expect(response.body.token).toEqual(expect.any(String));
  return response.body.token;
}

describe('API characterization', () => {
  beforeAll(async () => {
    await Setting.create([
      { key: 'standard_working_days', value: '26' },
      { key: 'leave_is_paid', value: 'true' },
    ]);

    await Employee.create({
      employee_id: employeeId,
      name: 'Test Employee',
      email: employeeCredentials.email,
      phone: '',
      address: '',
      department: 'Testing',
      designation: 'Test Role',
      joining_date: '2025-01-01',
      per_day_salary: 800,
      monthly_salary: 20800,
      overtime_rate: 150,
      status: 'active',
    });

    await User.create({
      username: adminCredentials.username,
      email: adminCredentials.email,
      password_hash: hashPassword(adminCredentials.password),
      role: 'ADMIN',
      employee_id: null,
      status: 'active',
    });
    await User.create({
      username: ownerCredentials.username,
      email: ownerCredentials.email,
      password_hash: hashPassword(ownerCredentials.password),
      role: 'SUPER_ADMIN',
      employee_id: null,
      status: 'active',
    });
    await User.create({
      username: employeeCredentials.username,
      email: employeeCredentials.email,
      password_hash: hashPassword(employeeCredentials.password),
      role: 'EMPLOYEE',
      employee_id: employeeId,
      status: 'active',
    });

    adminToken = await login(adminCredentials.username, adminCredentials.password);
    ownerToken = await login(ownerCredentials.username, ownerCredentials.password);
    employeeToken = await login(employeeCredentials.username, employeeCredentials.password);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('accepts valid login and rejects invalid credentials', async () => {
    const invalid = await request(app)
      .post('/api/auth/login')
      .send({ identifier: adminCredentials.username, password: 'incorrect-password' });

    expect(invalid.status).toBe(401);
    expect(invalid.body.error).toMatch(/invalid/i);
  });

  it('does not expose a forgot-password reset endpoint', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: employeeCredentials.email });

    expect(response.status).toBe(404);
  });

  it('sanitizes MongoDB connection failure logs', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMongoUri = process.env.MONGODB_URI;
    const fakeUri = 'mongodb+srv://audit-user:fake-password@cluster0.invalid/garment-shop';
    const connectionError = new Error(`Could not connect to ${fakeUri}`);
    connectionError.name = 'MongooseServerSelectionError';
    const connectionSpy = vi.spyOn(mongoose, 'connect').mockImplementationOnce(async () => {
      throw connectionError;
    });
    const errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = fakeUri;

    try {
      await expect(connectDB()).rejects.toThrow('MongoDB connection failed.');

      const loggedFailure = JSON.stringify(errorLogSpy.mock.calls);
      expect(loggedFailure).toContain('MongooseServerSelectionError');
      expect(loggedFailure).toContain('[MongoDB URI]');
      expect(loggedFailure).not.toContain('audit-user');
      expect(loggedFailure).not.toContain('fake-password');
      expect(loggedFailure).not.toContain('cluster0.invalid');
    } finally {
      connectionSpy.mockRestore();
      errorLogSpy.mockRestore();
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = originalMongoUri;
    }
  });

  it('requires a setup token when production is inferred from the server entry point', async () => {
    const email = `f06-production-${suffix}@example.test`;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSetupToken = process.env.SETUP_TOKEN;
    const previousArgv1 = process.argv[1];
    process.env.NODE_ENV = 'test';
    delete process.env.SETUP_TOKEN;
    process.argv[1] = 'C:\\app\\dist\\server.cjs';

    try {
      const response = await request(app)
        .post('/api/auth/setup-admin')
        .send({
          email,
          password: 'Secure-test-password-123!',
          username: `f06-${suffix}`,
        });

      expect(response.status).toBe(403);
      expect(await User.exists({ email })).toBeNull();
    } finally {
      await User.deleteOne({ email });
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousSetupToken === undefined) delete process.env.SETUP_TOKEN;
      else process.env.SETUP_TOKEN = previousSetupToken;
      if (previousArgv1 === undefined) process.argv.splice(1, 1);
      else process.argv[1] = previousArgv1;
    }
  });

  it('uses the business date for attendance dashboards and invoice numbers without shifting sale timestamps', async () => {
    const instant = new Date('2026-10-31T20:00:00.000Z');
    const businessDate = '2026-11-01';
    const idempotencyKey = `f13-business-date-${suffix}`;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instant);

    try {
      await Attendance.create({
        employee_id: employeeId,
        date: businessDate,
        status: 'Present',
        working_hours: 8,
        overtime_hours: 1,
      });
      await Payroll.create({
        employee_id: employeeId,
        month: 11,
        year: 2026,
        per_day_salary: 800,
        basic_salary: 20800,
        net_salary: 1234,
      });

      const adminDashboard = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      const ownerDashboard = await request(app)
        .get('/api/super-admin/overview')
        .set('Authorization', `Bearer ${ownerToken}`);
      const employeeDashboard = await request(app)
        .get('/api/employee/dashboard')
        .set('Authorization', `Bearer ${employeeToken}`);
      const roster = await request(app)
        .get('/api/admin/attendance/roster')
        .set('Authorization', `Bearer ${adminToken}`);
      const saleResponse = await request(app)
        .post('/api/shop/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          items: [{ name: 'F13 Test Item', quantity: 1, unit_price: 1 }],
          payment_method: 'Cash',
        });

      expect(adminDashboard.status).toBe(200);
      expect(adminDashboard.body.cards.presentToday).toBe(1);
      expect(adminDashboard.body.cards.currentMonthPayroll).toBe(1234);
      expect(adminDashboard.body.charts.dailyAttendance.at(-1).date).toBe(businessDate);
      expect(adminDashboard.body.charts.monthlyComparison.at(-1)).toMatchObject({
        month: 'Nov 2026',
        totalOt: 1,
      });
      expect(ownerDashboard.status).toBe(200);
      expect(ownerDashboard.body.metrics.todayPresentCount).toBe(1);
      expect(ownerDashboard.body.metrics.monthlyOvertimeExpense).toBe(150);
      expect(employeeDashboard.status).toBe(200);
      expect(employeeDashboard.body.stats.todayStatus).toBe('Present');
      expect(employeeDashboard.body.stats.presentDays).toBe(1);
      expect(roster.status).toBe(200);
      expect(roster.body.date).toBe(businessDate);
      expect(roster.body.roster.find((row: { employee_id: string }) => row.employee_id === employeeId).status).toBe('Present');
      expect(saleResponse.status).toBe(201);
      expect(saleResponse.body.sale.bill_number).toMatch(/^INV-20261101-/);
      expect(new Date(saleResponse.body.sale.date).toISOString()).toBe(instant.toISOString());
      expect(getBusinessDate(new Date(saleResponse.body.sale.date))).toBe(businessDate);
    } finally {
      vi.useRealTimers();
      await Attendance.deleteOne({ employee_id: employeeId, date: businessDate });
      await Payroll.deleteOne({ employee_id: employeeId, month: 11, year: 2026 });
      await Sale.deleteOne({ idempotency_key: idempotencyKey });
    }
  });

  it('revokes an employee session after an employee password reset', async () => {
    const employeeId = `F11-EMP-${suffix}`.toUpperCase();
    const username = `f11-employee-${suffix}`;
    const password = 'Employee-old-password-123!';
    await Employee.create({
      employee_id: employeeId,
      name: 'F11 Employee',
      email: `${username}@example.test`,
      phone: '',
      address: '',
      department: 'Testing',
      designation: 'Test Role',
      joining_date: '2025-01-01',
      per_day_salary: 800,
      monthly_salary: 20800,
      overtime_rate: 150,
      status: 'active',
    });
    await User.create({
      username,
      email: `${username}@example.test`,
      password_hash: hashPassword(password),
      role: 'EMPLOYEE',
      employee_id: employeeId,
      status: 'active',
    });
    const token = await login(username, password);

    const response = await request(app)
      .put(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'Employee-new-password-123!' });

    expect(response.status).toBe(200);
    expect(await Session.exists({ token })).toBeNull();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('revokes an administrator session after a password reset', async () => {
    const username = `f11-password-admin-${suffix}`;
    const target = await User.create({
      username,
      email: `${username}@example.test`,
      password_hash: hashPassword('Admin-old-password-123!'),
      role: 'ADMIN',
      employee_id: null,
      status: 'active',
    });
    const token = await login(username, 'Admin-old-password-123!');

    const response = await request(app)
      .put(`/api/super-admin/admins/${target._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ password: 'Admin-new-password-123!' });

    expect(response.status).toBe(200);
    expect(await Session.exists({ token })).toBeNull();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('revokes an administrator session when the account is deactivated', async () => {
    const username = `f11-deactivated-admin-${suffix}`;
    const target = await User.create({
      username,
      email: `${username}@example.test`,
      password_hash: hashPassword('Admin-status-password-123!'),
      role: 'ADMIN',
      employee_id: null,
      status: 'active',
    });
    const token = await login(username, 'Admin-status-password-123!');

    const response = await request(app)
      .put(`/api/super-admin/admins/${target._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'inactive' });

    expect(response.status).toBe(200);
    expect(await Session.exists({ token })).toBeNull();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('revokes sessions when setup-admin resets an existing account password', async () => {
    const username = `f11-setup-admin-${suffix}`;
    const email = `${username}@example.test`;
    const target = await User.create({
      username,
      email,
      password_hash: hashPassword('Setup-old-password-123!'),
      role: 'SUPER_ADMIN',
      employee_id: null,
      status: 'active',
    });
    const token = await login(username, 'Setup-old-password-123!');
    const previousSetupToken = process.env.SETUP_TOKEN;
    process.env.SETUP_TOKEN = `test-setup-${suffix}`;

    try {
      const response = await request(app)
        .post('/api/auth/setup-admin')
        .send({
          email,
          password: 'Setup-new-password-123!',
          username,
          setupToken: process.env.SETUP_TOKEN,
        });

      expect(response.status).toBe(200);
      expect(await Session.exists({ token })).toBeNull();
      expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    } finally {
      if (previousSetupToken === undefined) delete process.env.SETUP_TOKEN;
      else process.env.SETUP_TOKEN = previousSetupToken;
      await User.deleteOne({ _id: target._id });
    }
  });

  it('allows an employee into employee routes and denies admin routes', async () => {
    const profile = await request(app)
      .get('/api/employee/profile')
      .set('Authorization', `Bearer ${employeeToken}`);
    const forbidden = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(profile.status).toBe(200);
    expect(profile.body.employee.employee_id).toBe(employeeId);
    expect(forbidden.status).toBe(403);
  });

  it('allows an admin to access the admin dashboard', async () => {
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('cards');
  });

  it('paginates employee and attendance lists, clamps limits, and rejects invalid pagination', async () => {
    const employeePage = await request(app)
      .get(`/api/admin/employees?limit=${EMPLOYEE_PAGE_SIZE_MAX + 1}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const attendancePage = await request(app)
      .get(`/api/admin/attendance?limit=${ATTENDANCE_PAGE_SIZE_MAX + 1}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const invalidEmployeePage = await request(app)
      .get('/api/admin/employees?page=not-a-number')
      .set('Authorization', `Bearer ${adminToken}`);
    const invalidAttendanceLimit = await request(app)
      .get('/api/admin/attendance?limit=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(employeePage.status).toBe(200);
    expect(employeePage.body).toMatchObject({
      page: 1,
      limit: EMPLOYEE_PAGE_SIZE_MAX,
    });
    expect(employeePage.body.data.length).toBeLessThanOrEqual(EMPLOYEE_PAGE_SIZE_MAX);
    expect(attendancePage.status).toBe(200);
    expect(attendancePage.body.limit).toBe(ATTENDANCE_PAGE_SIZE_MAX);
    expect(invalidEmployeePage.status).toBe(400);
    expect(invalidAttendanceLimit.status).toBe(400);
    expect(EMPLOYEE_PAGE_SIZE_DEFAULT).toBe(50);
    expect(ATTENDANCE_PAGE_SIZE_DEFAULT).toBe(100);
  });

  it('rolls back payroll finalization when its strict audit write fails', async () => {
    const payroll = await Payroll.create({
      employee_id: employeeId,
      month: 7,
      year: 2048,
      working_days: 26,
      per_day_salary: 800,
      basic_salary: 800,
      net_salary: 800,
      status: 'Draft',
    });
    const auditWrite = vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('forced audit failure'));

    try {
      const response = await request(app)
        .put('/api/admin/payroll/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payroll_id: payroll._id.toString(), status: 'Finalized' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update payroll status.');
      expect(JSON.stringify(response.body)).not.toContain('forced audit failure');
      expect((await Payroll.findById(payroll._id))?.status).toBe('Draft');
    } finally {
      auditWrite.mockRestore();
      await Payroll.deleteOne({ _id: payroll._id });
    }
  });

  it('rolls back employee archive when its strict audit write fails', async () => {
    const archiveId = `F15-ARCHIVE-${suffix}`;
    await Employee.create({
      employee_id: archiveId,
      name: 'F15 Archive Test',
      email: `f15-archive-${suffix}@example.test`,
      department: 'F15-Test',
      designation: 'Test Worker',
      joining_date: '2026-01-01',
      per_day_salary: 800,
      monthly_salary: 20800,
      overtime_rate: 150,
      status: 'active',
      is_active: true,
    });
    const auditWrite = vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('forced audit failure'));

    try {
      const response = await request(app)
        .delete(`/api/admin/employees/${archiveId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete employee.');
      expect(JSON.stringify(response.body)).not.toContain('forced audit failure');
      expect(await Employee.findOne({ employee_id: archiveId })).toMatchObject({
        status: 'active',
        is_active: true,
      });
    } finally {
      auditWrite.mockRestore();
      await Employee.deleteOne({ employee_id: archiveId });
    }
  });

  it('logs best-effort audit failures while allowing the business operation', async () => {
    const categoryCode = `F15-${suffix}`.toUpperCase();
    const auditWrite = vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('forced audit failure'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await request(app)
        .post('/api/shop/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'F15 Audit Failure Test', code: categoryCode });

      expect(response.status).toBe(201);
      expect(await Category.exists({ code: categoryCode })).not.toBeNull();
      const loggedLine = errorLog.mock.calls
        .flat()
        .find((value) => typeof value === 'string' && value.includes('AUDIT_WRITE_FAILED'));
      expect(loggedLine).toContain('"action":"CATEGORY_CREATED"');
      expect(loggedLine).toContain(`"entityId":"Category ${categoryCode} (F15 Audit Failure Test)"`);
      expect(loggedLine).toContain('"error":"forced audit failure"');
    } finally {
      auditWrite.mockRestore();
      errorLog.mockRestore();
      await Category.deleteOne({ code: categoryCode });
    }
  });

  it('filters attendance by inclusive date range and employee with pagination', async () => {
    const dates = ['2050-01-01', '2050-01-02'];
    await Promise.all(
      dates.map((date) => Attendance.create({
        employee_id: employeeId,
        date,
        status: 'Present',
        working_hours: 8,
        overtime_hours: 0,
      }))
    );

    try {
      const response = await request(app)
        .get('/api/admin/attendance')
        .query({
          start_date: dates[0],
          end_date: dates[1],
          employee_id: employeeId,
          page: 2,
          limit: 1,
        })
        .set('Authorization', `Bearer ${adminToken}`);
      const invalidRange = await request(app)
        .get('/api/admin/attendance')
        .query({ start_date: dates[1], end_date: dates[0] })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ page: 2, limit: 1, total: 2 });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        employee_id: employeeId,
        date: dates[0],
      });
      expect(invalidRange.status).toBe(400);
    } finally {
      await Attendance.deleteMany({ employee_id: employeeId, date: { $in: dates } });
    }
  });

  it('preserves inventory and sales report totals using database aggregates', async () => {
    const skuPrefix = `F14-${suffix}`;
    const saleKeyPrefix = `f14-${suffix}`;
    await Product.create([
      {
        name: 'F14 In Stock',
        sku: `${skuPrefix}-IN`,
        category: 'F14 Test',
        cost_price: 10.25,
        selling_price: 20.5,
        stock_quantity: 3,
        min_stock_alert: 2,
      },
      {
        name: 'F14 Low Stock',
        sku: `${skuPrefix}-LOW`,
        category: 'F14 Test',
        cost_price: 2,
        selling_price: 4,
        stock_quantity: 1,
        min_stock_alert: 2,
      },
    ]);
    await Sale.create([
      {
        bill_number: `${saleKeyPrefix}-completed`,
        items: [],
        subtotal: 100,
        discount: 0,
        tax: 0,
        total_amount: 100,
        payment_method: 'Cash',
        status: 'Completed',
        idempotency_key: `${saleKeyPrefix}-completed`,
        idempotency_hash: 'test-hash',
      },
      {
        bill_number: `${saleKeyPrefix}-cancelled`,
        items: [],
        subtotal: 50,
        discount: 0,
        tax: 0,
        total_amount: 50,
        payment_method: 'Cash',
        status: 'Cancelled',
        idempotency_key: `${saleKeyPrefix}-cancelled`,
        idempotency_hash: 'test-hash',
      },
    ]);

    try {
      const response = await request(app)
        .get('/api/shop/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      const products = await Product.find();
      const sales = await Sale.find();

      expect(response.status).toBe(200);
      expect(response.body.summary.totalProducts).toBe(products.length);
      expect(response.body.summary.totalCategories).toBe(await Category.countDocuments());
      expect(response.body.summary.totalStockUnits).toBe(
        products.reduce((sum, product) => sum + product.stock_quantity, 0)
      );
      expect(response.body.summary.totalCostValuation).toBe(
        Math.round(products.reduce((sum, product) => sum + product.stock_quantity * product.cost_price, 0))
      );
      expect(response.body.summary.totalInvoicesIssued).toBe(sales.length);
      expect(response.body.summary.totalSalesRevenue).toBe(
        Math.round(
          sales.reduce(
            (sum, sale) => sum + (sale.status === 'Completed' ? sale.total_amount : 0),
            0
          )
        )
      );
      expect(response.body.lowStockProducts).toEqual(
        expect.arrayContaining([expect.objectContaining({ sku: `${skuPrefix}-LOW`.toUpperCase() })])
      );
    } finally {
      await Product.deleteMany({ sku: { $in: [`${skuPrefix}-IN`, `${skuPrefix}-LOW`] } });
      await Sale.deleteMany({ idempotency_key: { $in: [`${saleKeyPrefix}-completed`, `${saleKeyPrefix}-cancelled`] } });
    }
  });

  it('keeps the complete daily roster when active employees exceed the employee page default', async () => {
    const rosterEmployees = Array.from({ length: EMPLOYEE_PAGE_SIZE_DEFAULT + 1 }, (_, index) => ({
      employee_id: `F14-ROSTER-${suffix}-${index}`,
      name: `F14 Roster Employee ${index}`,
      email: `f14-roster-${suffix}-${index}@example.test`,
      department: 'F14-Roster',
      designation: 'Test Worker',
      joining_date: '2026-01-01',
      per_day_salary: 800,
      monthly_salary: 20800,
      overtime_rate: 150,
      status: 'active' as const,
      is_active: true,
    }));
    const employeeIds = rosterEmployees.map((employee) => employee.employee_id.toUpperCase());
    const activeBefore = await Employee.countDocuments({
      status: 'active',
      is_active: { $ne: false },
    });

    await Employee.create(rosterEmployees);
    try {
      const employeeList = await request(app)
        .get('/api/admin/employees?department=F14-Roster')
        .set('Authorization', `Bearer ${adminToken}`);
      const roster = await request(app)
        .get('/api/admin/attendance/roster?date=2050-02-01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(employeeList.status).toBe(200);
      expect(employeeList.body.data).toHaveLength(EMPLOYEE_PAGE_SIZE_DEFAULT);
      expect(employeeList.body.total).toBe(EMPLOYEE_PAGE_SIZE_DEFAULT + 1);
      expect(roster.status).toBe(200);
      expect(roster.body.summary.totalEmployees).toBe(activeBefore + rosterEmployees.length);
      expect(roster.body.roster).toHaveLength(roster.body.summary.totalEmployees);
      expect(roster.body.roster.map((row: { employee_id: string }) => row.employee_id))
        .toEqual(expect.arrayContaining(employeeIds));
    } finally {
      await Employee.deleteMany({ employee_id: { $in: employeeIds } });
    }
  });

  it('creates or updates an attendance record through the admin API', async () => {
    const date = '2025-01-02';
    const response = await request(app)
      .post('/api/admin/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employee_id: employeeId,
        date,
        status: 'Present',
        working_hours: 8,
        overtime_hours: 1,
        notes: 'API test',
      });

    expect(response.status).toBe(200);
    const record = await Attendance.findOne({ employee_id: employeeId, date });
    expect(record?.status).toBe('Present');
    expect(record?.overtime_hours).toBe(1);
  });

  it('keeps unrecorded attendance unmarked and excludes it from payroll', async () => {
    const date = '2025-03-03';
    const roster = await request(app)
      .get(`/api/admin/attendance/roster?date=${date}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(roster.status).toBe(200);
    expect(roster.body.roster.find((row: { employee_id: string }) => row.employee_id === employeeId)).toMatchObject({
      status: 'Unmarked',
      working_hours: 0,
      overtime_hours: 0,
    });
    expect(roster.body.summary.present).toBe(0);

    const generated = await request(app)
      .post('/api/admin/payroll/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 3, year: 2025, employee_id: employeeId });

    expect(generated.status).toBe(200);
    const payroll = await Payroll.findOne({ employee_id: employeeId, month: 3, year: 2025 });
    expect(payroll?.present_days).toBe(0);
    expect(payroll?.net_salary).toBe(0);
    expect(await Attendance.countDocuments({ employee_id: employeeId, date })).toBe(0);
  });

  it('rejects invalid attendance dates, employees, statuses, and hour ranges', async () => {
    const invalidPayloads = [
      { employee_id: employeeId, date: '2025-02-30', status: 'Present' },
      { employee_id: `MISSING-${suffix}`, date: '2025-02-03', status: 'Present' },
      { employee_id: employeeId, date: '2025-02-03', status: 'Working' },
      { employee_id: employeeId, date: '2025-02-03', status: 'Present', working_hours: 16.1 },
      { employee_id: employeeId, date: '2025-02-03', status: 'Present', overtime_hours: 2.1 },
      { employee_id: employeeId, date: '2025-02-03', status: 'Present', working_hours: -1 },
      { employee_id: employeeId, date: '2025-02-03', status: 'Present', overtime_hours: -0.1 },
      { employee_id: employeeId, date: '2025-02-03', status: 'Present', working_hours: 'NaN' },
    ];

    for (const payload of invalidPayloads) {
      const response = await request(app)
        .post('/api/admin/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status, JSON.stringify(payload)).toBe(400);
    }

    expect(await Attendance.countDocuments({ date: '2025-02-03' })).toBe(0);
  });

  it('accepts attendance at the confirmed daily hour limits', async () => {
    const response = await request(app)
      .post('/api/admin/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employee_id: employeeId,
        date: '2025-02-05',
        status: 'Present',
        working_hours: 16,
        overtime_hours: 2,
      });

    expect(response.status).toBe(200);
    const record = await Attendance.findOne({ employee_id: employeeId, date: '2025-02-05' });
    expect(record?.working_hours).toBe(16);
    expect(record?.overtime_hours).toBe(2);
  });

  it('rejects a batch if any attendance row is invalid before saving any rows', async () => {
    const response = await request(app)
      .post('/api/admin/attendance/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2025-02-04',
        records: [
          { employee_id: employeeId, status: 'Present', working_hours: 8, overtime_hours: 0 },
          { employee_id: `MISSING-${suffix}`, status: 'Present', working_hours: 8, overtime_hours: 0 },
        ],
      });

    expect(response.status).toBe(400);
    expect(await Attendance.countDocuments({ date: '2025-02-04' })).toBe(0);
  });

  it('rejects missing and non-positive daily salaries when creating employees', async () => {
    const invalidSalaries = [undefined, 0, -1, 'not-a-number'];

    for (const [index, per_day_salary] of invalidSalaries.entries()) {
      const email = `invalid-salary-${index}-${suffix}@example.test`;
      const response = await request(app)
        .post('/api/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Salary Employee',
          email,
          department: 'Testing',
          designation: 'Test Role',
          password: 'Test-password-123!',
          per_day_salary,
        });

      expect(response.status).toBe(400);
      expect(await Employee.exists({ email })).toBeNull();
    }
  });

  it('requires a daily salary when creating an Employee model directly', async () => {
    const employee = new Employee({
      employee_id: `NO-SALARY-${suffix}`,
      name: 'Missing Salary Employee',
      email: `no-salary-${suffix}@example.test`,
      department: 'Testing',
      designation: 'Test Role',
      joining_date: '2025-01-01',
    });

    await expect(employee.validate()).rejects.toThrow(/per_day_salary/);
  });

  it('rejects non-positive daily salary updates without changing the existing salary', async () => {
    for (const per_day_salary of [0, -1, 'not-a-number']) {
      const response = await request(app)
        .put(`/api/admin/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ per_day_salary });

      expect(response.status).toBe(400);
      expect((await Employee.findOne({ employee_id: employeeId }))?.per_day_salary).toBe(800);
    }
  });

  it('generates payroll and allows an admin to mark it paid', async () => {
    await Attendance.create({
      employee_id: employeeId,
      date: '2025-02-03',
      status: 'Present',
      working_hours: 8,
      overtime_hours: 0,
    });

    const generated = await request(app)
      .post('/api/admin/payroll/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 2, year: 2025, employee_id: employeeId });

    expect(generated.status).toBe(200);
    expect(generated.body.processedCount).toBe(1);

    const payroll = await Payroll.findOne({ employee_id: employeeId, month: 2, year: 2025 });
    expect(payroll?.status).toBe('Finalized');
    expect(payroll?.net_salary).toBeGreaterThan(0);

    const finalizedEdit = await request(app)
      .put(`/api/admin/payroll/${payroll?._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bonus: 100 });
    expect(finalizedEdit.status).toBe(409);

    const paid = await request(app)
      .put('/api/admin/payroll/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payroll_id: payroll?._id.toString(), status: 'Paid' });

    expect(paid.status).toBe(200);
    expect((await Payroll.findById(payroll?._id))?.status).toBe('Paid');

    const regenerated = await request(app)
      .post('/api/admin/payroll/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 2, year: 2025, employee_id: employeeId });
    expect(regenerated.status).toBe(409);

    const paidEdit = await request(app)
      .put(`/api/admin/payroll/${payroll?._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deductions: 100 });
    expect(paidEdit.status).toBe(409);

    const rollbackPaid = await request(app)
      .put('/api/admin/payroll/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payroll_id: payroll?._id.toString(), status: 'Draft' });
    expect(rollbackPaid.status).toBe(409);
    expect((await Payroll.findById(payroll?._id))?.status).toBe('Paid');
  });

  it('finalizes only drafts and rejects edits and recalculation for locked payroll', async () => {
    const statuses = ['Draft', 'Finalized', 'Paid'] as const;
    const employees = await Employee.create(
      statuses.map((_, index) => ({
        employee_id: `F03-${index}-${suffix}`,
        name: `F03 Employee ${index}`,
        email: `f03-${index}-${suffix}@example.test`,
        phone: '',
        address: '',
        department: 'Testing',
        designation: 'Test Role',
        joining_date: '2025-01-01',
        per_day_salary: 100,
        monthly_salary: 2600,
        overtime_rate: 10,
        status: 'active' as const,
      }))
    );
    const payrolls = await Promise.all(
      employees.map((employee, index) =>
        Payroll.create({
          employee_id: employee.employee_id,
          month: 7,
          year: 2025,
          working_days: 26,
          present_days: 1,
          absent_days: 0,
          leave_days: 0,
          half_days: 0,
          overtime_hours: 0,
          extra_working_days: 0,
          per_day_salary: 100,
          basic_salary: 100,
          extra_day_salary: 0,
          overtime_salary: 0,
          bonus: 0,
          deductions: 0,
          net_salary: 100,
          status: statuses[index],
        })
      )
    );

    const finalizedAll = await request(app)
      .post('/api/admin/payroll/finalize-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 7, year: 2025 });

    expect(finalizedAll.status).toBe(200);
    expect(finalizedAll.body.modifiedCount).toBe(1);
    expect(await Promise.all(payrolls.map(async (payroll) => (
      (await Payroll.findById(payroll._id))?.status
    )))).toEqual(['Finalized', 'Finalized', 'Paid']);

    for (const index of [1, 2]) {
      const payroll = payrolls[index];
      const edit = await request(app)
        .put(`/api/admin/payroll/${payroll._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bonus: 50 });
      expect(edit.status).toBe(409);

      const recalculation = await request(app)
        .post('/api/admin/payroll/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ month: 7, year: 2025, employee_id: payroll.employee_id });
      expect(recalculation.status).toBe(409);
      expect((await Payroll.findById(payroll._id))?.net_salary).toBe(100);
    }
  });

  it('rejects an existing user email with a new derived username without creating an employee', async () => {
    const email = `f10-email-${suffix}@example.test`;
    const derivedUsername = email.split('@')[0];
    const existingUsername = `existing-${suffix}`;
    await User.create({
      username: existingUsername,
      email,
      password_hash: hashPassword('Test-password-123!'),
      role: 'EMPLOYEE',
      employee_id: null,
      status: 'active',
    });

    const response = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'F10 Email Conflict',
        email,
        department: 'Testing',
        designation: 'Test Role',
        per_day_salary: 800,
        password: 'Test-password-123!',
      });

    expect(response.status).toBe(409);
    expect(await Employee.exists({ email })).toBeNull();
    expect(await User.exists({ email, username: existingUsername })).toBeTruthy();
    expect(await User.exists({ username: derivedUsername })).toBeNull();
  });

  it('rejects employee creation when the derived username is already in use', async () => {
    const email = `f10-username-${suffix}@example.test`;
    await User.create({
      username: `f10-username-${suffix}`,
      email: `different-${suffix}@example.test`,
      password_hash: hashPassword('Test-password-123!'),
      role: 'EMPLOYEE',
      employee_id: null,
      status: 'active',
    });

    const response = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'F10 Username Conflict',
        email,
        department: 'Testing',
        designation: 'Test Role',
        per_day_salary: 800,
        password: 'Test-password-123!',
      });

    expect(response.status).toBe(409);
    expect(await Employee.exists({ email })).toBeNull();
  });

  it('creates only one employee and account for concurrent identical registrations', async () => {
    const email = `f10-concurrent-${suffix}@example.test`;
    const payload = {
      name: 'F10 Concurrent Employee',
      email,
      department: 'Testing',
      designation: 'Test Role',
      per_day_salary: 800,
      password: 'Test-password-123!',
    };
    const createEmployee = () =>
      request(app)
        .post('/api/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

    const responses = await Promise.all([createEmployee(), createEmployee()]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await Employee.countDocuments({ email })).toBe(1);
    expect(await User.countDocuments({ email })).toBe(1);
  });

  it('processes a catalog sale using the server-side product price', async () => {
    const product = await Product.create({
      name: 'Test Garment',
      sku: `TEST-${suffix}`,
      category: 'Test',
      size: 'M',
      color: 'Blue',
      fabric: 'Cotton',
      cost_price: 40,
      selling_price: 100,
      stock_quantity: 2,
      min_stock_alert: 1,
      status: 'active',
    });

    const response = await request(app)
      .post('/api/shop/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `f04-catalog-${suffix}`)
      .send({
        items: [{ product_id: product._id.toString(), quantity: 1, unit_price: 1 }],
        payment_method: 'Cash',
      });

    expect(response.status).toBe(201);
    expect(response.body.sale.total_amount).toBe(100);
    expect((await Product.findById(product._id))?.stock_quantity).toBe(1);
  });

  it('uses a string-only partial unique idempotency index while allowing legacy sales without keys', async () => {
    await Sale.init();
    const indexes = await Sale.collection.indexes();
    const idempotencyIndex = indexes.find((index) => index.name === 'idempotency_key_string_unique');
    expect(idempotencyIndex).toMatchObject({
      unique: true,
      partialFilterExpression: { idempotency_key: { $type: 'string' } },
    });

    const legacyBillNumbers = [`LEGACY-A-${suffix}`, `LEGACY-B-${suffix}`];
    try {
      await Sale.collection.insertMany(
        legacyBillNumbers.map((bill_number) => ({ bill_number, total_amount: 0 }))
      );
      expect(await Sale.collection.countDocuments({ bill_number: { $in: legacyBillNumbers } })).toBe(2);
    } finally {
      await Sale.collection.deleteMany({ bill_number: { $in: legacyBillNumbers } });
    }
  });

  it('replays a sale safely for the same idempotency key', async () => {
    const product = await Product.create({
      name: 'Idempotency Test Garment',
      sku: `IDEMPOTENCY-${suffix}`,
      category: 'Test',
      size: 'M',
      color: 'Blue',
      fabric: 'Cotton',
      cost_price: 40,
      selling_price: 100,
      stock_quantity: 2,
      min_stock_alert: 1,
      status: 'active',
    });
    const idempotencyKey = `f04-retry-${suffix}`;
    const payload = {
      items: [{ product_id: product._id.toString(), quantity: 1 }],
      payment_method: 'Cash',
    };

    const [first, retry] = await Promise.all([
      request(app)
        .post('/api/shop/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload),
      request(app)
        .post('/api/shop/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload),
    ]);
    const keyReuse = await request(app)
      .post('/api/shop/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...payload, items: [{ product_id: product._id.toString(), quantity: 2 }] });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.sale.bill_number).toBe(first.body.sale.bill_number);
    expect(keyReuse.status).toBe(409);
    expect(await Sale.countDocuments({ idempotency_key: idempotencyKey })).toBe(1);
    expect((await Product.findById(product._id))?.stock_quantity).toBe(1);
  });

  it('merges duplicate cart lines before decrementing stock', async () => {
    const product = await Product.create({
      name: 'Duplicate Line Test Garment',
      sku: `DUPLICATE-${suffix}`,
      category: 'Test',
      size: 'M',
      color: 'Blue',
      fabric: 'Cotton',
      cost_price: 40,
      selling_price: 100,
      stock_quantity: 2,
      min_stock_alert: 1,
      status: 'active',
    });

    const response = await request(app)
      .post('/api/shop/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `f04-duplicate-${suffix}`)
      .send({
        items: [
          { product_id: product._id.toString(), quantity: 1 },
          { product_id: product._id.toString(), quantity: 1 },
        ],
        payment_method: 'Cash',
      });

    expect(response.status).toBe(201);
    expect(response.body.sale.items).toHaveLength(1);
    expect(response.body.sale.items[0].quantity).toBe(2);
    expect((await Product.findById(product._id))?.stock_quantity).toBe(0);
  });

  it('rolls back earlier stock decrements if any cart item cannot be sold', async () => {
    const products = await Product.create([
      {
        name: 'Rollback Test Available Garment',
        sku: `ROLLBACK-AVAILABLE-${suffix}`,
        category: 'Test',
        size: 'M',
        color: 'Blue',
        fabric: 'Cotton',
        cost_price: 40,
        selling_price: 100,
        stock_quantity: 1,
        min_stock_alert: 1,
        status: 'active',
      },
      {
        name: 'Rollback Test Empty Garment',
        sku: `ROLLBACK-EMPTY-${suffix}`,
        category: 'Test',
        size: 'M',
        color: 'Blue',
        fabric: 'Cotton',
        cost_price: 40,
        selling_price: 100,
        stock_quantity: 0,
        min_stock_alert: 1,
        status: 'active',
      },
    ]);
    const idempotencyKey = `f04-rollback-${suffix}`;

    const response = await request(app)
      .post('/api/shop/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        items: products.map((product) => ({ product_id: product._id.toString(), quantity: 1 })),
        payment_method: 'Cash',
      });

    expect(response.status).toBe(400);
    expect((await Product.findById(products[0]._id))?.stock_quantity).toBe(1);
    expect((await Product.findById(products[1]._id))?.stock_quantity).toBe(0);
    expect(await Sale.countDocuments({ idempotency_key: idempotencyKey })).toBe(0);
  });

  it('generates unique invoice numbers for concurrent distinct sales', async () => {
    const products = await Product.create([
      {
        name: 'Concurrent Invoice Garment A',
        sku: `CONCURRENT-A-${suffix}`,
        category: 'Test',
        size: 'M',
        color: 'Blue',
        fabric: 'Cotton',
        cost_price: 40,
        selling_price: 100,
        stock_quantity: 1,
        min_stock_alert: 1,
        status: 'active',
      },
      {
        name: 'Concurrent Invoice Garment B',
        sku: `CONCURRENT-B-${suffix}`,
        category: 'Test',
        size: 'M',
        color: 'Blue',
        fabric: 'Cotton',
        cost_price: 40,
        selling_price: 100,
        stock_quantity: 1,
        min_stock_alert: 1,
        status: 'active',
      },
    ]);

    const responses = await Promise.all(products.map((product, index) =>
      request(app)
        .post('/api/shop/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `f04-invoice-${index}-${suffix}`)
        .send({
          items: [{ product_id: product._id.toString(), quantity: 1 }],
          payment_method: 'Cash',
        })
    ));

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(new Set(responses.map((response) => response.body.sale.bill_number)).size).toBe(2);
  });

  it('seeds invoice numbers above existing sales even when the daily counter is stale', async () => {
    const dateKey = getBusinessDate(new Date());
    const invoicePrefix = `INV-${dateKey.replace(/-/g, '')}-`;
    const existingSales = await Sale.find({ bill_number: new RegExp(`^${invoicePrefix}`) })
      .select({ bill_number: 1 })
      .lean();
    const currentMaximum = existingSales.reduce((max, existingSale) => {
      const sequence = Number(existingSale.bill_number.slice(invoicePrefix.length));
      return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    const historicalSequence = currentMaximum + 50;
    const historicalBillNumber = `${invoicePrefix}${String(historicalSequence).padStart(4, '0')}`;
    const idempotencyKey = `f04-counter-seed-${suffix}`;
    const counterValue = Math.max(0, currentMaximum);

    const product = await Product.create({
      name: 'Counter Seed Test Garment',
      sku: `COUNTER-${suffix}`,
      category: 'Test',
      size: 'M',
      color: 'Blue',
      fabric: 'Cotton',
      cost_price: 40,
      selling_price: 100,
      stock_quantity: 1,
      min_stock_alert: 1,
      status: 'active',
    });
    await Sale.create({
      bill_number: historicalBillNumber,
      customer_name: 'Counter Seed Test',
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total_amount: 0,
      payment_method: 'Cash',
      cashier_name: 'Test',
      status: 'Completed',
      date: new Date(),
      idempotency_key: idempotencyKey,
      idempotency_hash: 'a'.repeat(64),
    });
    await InvoiceCounter.updateOne(
      { key: dateKey },
      { $set: { value: counterValue } },
      { upsert: true }
    );

    const response = await request(app)
      .post('/api/shop/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `f04-counter-next-${suffix}`)
      .send({
        items: [{ product_id: product._id.toString(), quantity: 1 }],
        payment_method: 'Cash',
      });

    expect(response.status).toBe(201);
    expect(response.body.sale.bill_number).toBe(
      `${invoicePrefix}${String(historicalSequence + 1).padStart(4, '0')}`
    );
    await Product.deleteOne({ _id: product._id });
  });

  it('F-02: returns unmarked attendance when no record exists', async () => {
    const response = await request(app)
      .get('/api/admin/attendance/roster?date=2025-01-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.body.roster[0].status).toBe('Unmarked');
  });

  it('F-03: never recalculates or finalizes a paid payroll record', async () => {
    const payroll = await Payroll.findOne({ employee_id: employeeId, month: 2, year: 2025 });
    await request(app)
      .post('/api/admin/payroll/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 2, year: 2025, employee_id: employeeId });
    await request(app)
      .post('/api/admin/payroll/finalize-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 2, year: 2025 });

    expect((await Payroll.findById(payroll?._id))?.status).toBe('Paid');
  });

  it('F-04: only one concurrent sale succeeds for the final stock unit', async () => {
    const product = await Product.create({
      name: 'Last Unit Test Garment',
      sku: `LAST-${suffix}`,
      category: 'Test',
      size: 'M',
      color: 'Blue',
      fabric: 'Cotton',
      cost_price: 40,
      selling_price: 100,
      stock_quantity: 1,
      min_stock_alert: 1,
      status: 'active',
    });
    const payload = {
      items: [{ product_id: product._id.toString(), quantity: 1 }],
      payment_method: 'Cash',
    };

    const responses = await Promise.all([
      request(app).post('/api/shop/sales').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', `f04-last-a-${suffix}`).send(payload),
      request(app).post('/api/shop/sales').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', `f04-last-b-${suffix}`).send(payload),
    ]);

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
  });

  it('archives an employee, revokes access, and preserves historical business records', async () => {
    const date = '2025-08-03';
    const statusEmployeeId = `F05-STATUS-${suffix}`.toUpperCase();
    const statusEmployee = await Employee.create({
      employee_id: statusEmployeeId,
      name: 'F05 Status Employee',
      email: `f05-status-${suffix}@example.test`,
      phone: '',
      address: '',
      department: 'Testing',
      designation: 'Test Role',
      joining_date: '2025-01-01',
      per_day_salary: 800,
      monthly_salary: 20800,
      overtime_rate: 150,
      status: 'active',
    });
    expect(await User.findOne({ username: `f05-status-${suffix}` })).toBeNull();
    const statusUser = await User.create({
      username: `f05-status-${suffix}`,
      email: `f05-status-${suffix}@example.test`,
      password_hash: hashPassword('Test-password-123!'),
      role: 'EMPLOYEE',
      employee_id: statusEmployeeId,
      status: 'active',
    });
    const statusToken = `f05-session-${suffix}`;
    await Session.create({
      token: statusToken,
      user_id: statusUser._id.toString(),
      role: 'EMPLOYEE',
      employee_id: statusEmployeeId,
      expires_at: new Date(Date.now() + 60_000),
    });

    const deactivated = await request(app)
      .put(`/api/admin/employees/${statusEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });
    expect(deactivated.status).toBe(200);
    expect((await Employee.findOne({ employee_id: statusEmployeeId }))?.is_active).toBe(false);
    const deactivatedUser = await User.findOne({ username: `f05-status-${suffix}` })
      .select({ employee_id: 1, status: 1 })
      .lean();
    expect(deactivatedUser).toMatchObject({ employee_id: statusEmployeeId, status: 'inactive' });
    expect(await Session.exists({ token: statusToken })).toBeNull();

    const payroll = await Payroll.create({
      employee_id: employeeId,
      month: 8,
      year: 2025,
      working_days: 26,
      present_days: 1,
      absent_days: 0,
      leave_days: 0,
      half_days: 0,
      overtime_hours: 0,
      extra_working_days: 0,
      per_day_salary: 800,
      basic_salary: 800,
      extra_day_salary: 0,
      overtime_salary: 0,
      bonus: 0,
      deductions: 0,
      net_salary: 800,
      status: 'Finalized',
    });
    await Attendance.create({
      employee_id: employeeId,
      date,
      status: 'Present',
      working_hours: 8,
      overtime_hours: 0,
    });
    expect(await Session.exists({ token: employeeToken })).not.toBeNull();

    const archived = await request(app)
      .delete(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(archived.status).toBe(200);
    const employee = await Employee.findOne({ employee_id: employeeId });
    expect(employee?.is_active).toBe(false);
    expect(employee?.archived_at).toBeInstanceOf(Date);
    expect(employee?.archived_by).toBe(adminCredentials.username);
    expect(employee?.status).toBe('inactive');
    expect((await User.findOne({ employee_id: employeeId }))?.status).toBe('inactive');
    expect(await Session.exists({ token: employeeToken })).toBeNull();

    const archivedList = await request(app)
      .get(`/api/admin/employees?search=${employeeId}&include_archived=true`)
      .set('Authorization', `Bearer ${adminToken}`);
    const defaultList = await request(app)
      .get(`/api/admin/employees?search=${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const roster = await request(app)
      .get(`/api/admin/attendance/roster?date=${date}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const history = await request(app)
      .get(`/api/admin/attendance?date=${date}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const payrollHistory = await request(app)
      .get('/api/admin/payroll?month=8&year=2025')
      .set('Authorization', `Bearer ${adminToken}`);
    const oldSession = await request(app)
      .get('/api/employee/profile')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(archivedList.body.data.map((item: { employee_id: string }) => item.employee_id)).toContain(employeeId);
    expect(defaultList.body.data.map((item: { employee_id: string }) => item.employee_id)).not.toContain(employeeId);
    expect(roster.body.roster.map((item: { employee_id: string }) => item.employee_id)).not.toContain(employeeId);
    expect(history.body.data.map((item: { employee_id: string }) => item.employee_id)).toContain(employeeId);
    expect(payrollHistory.body.payroll.map((item: { employee_id: string }) => item.employee_id)).toContain(employeeId);
    expect(await Attendance.exists({ employee_id: employeeId, date })).not.toBeNull();
    expect(await Payroll.exists({ _id: payroll._id })).not.toBeNull();
    expect(oldSession.status).toBe(401);
  });
});
