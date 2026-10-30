import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const mongo = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
});

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongo.getUri();
process.env.SESSION_SECRET = 'test-session-secret-with-more-than-thirty-two-characters';

const mongoose = (await import('mongoose')).default;
await mongoose.connect(process.env.MONGODB_URI);

const { Attendance, Employee, Payroll, Product, Session, Setting, User, hashPassword } =
  await import('../server/db.ts');
const { default: authRoutes } = await import('../server/routes/authRoutes.ts');
const { default: adminRoutes } = await import('../server/routes/adminRoutes.ts');
const { default: employeeRoutes } = await import('../server/routes/employeeRoutes.ts');
const { default: shopRoutes } = await import('../server/routes/shopRoutes.ts');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/shop', shopRoutes);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const adminCredentials = {
  username: `admin-${suffix}`,
  email: `admin-${suffix}@example.test`,
  password: 'Test-password-123!',
};
const employeeId = `TEST-${suffix}`.toUpperCase();
const employeeCredentials = {
  username: `employee-${suffix}`,
  email: `employee-${suffix}@example.test`,
  password: 'Employee-password-123!',
};
let adminToken = '';
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
      username: employeeCredentials.username,
      email: employeeCredentials.email,
      password_hash: hashPassword(employeeCredentials.password),
      role: 'EMPLOYEE',
      employee_id: employeeId,
      status: 'active',
    });

    adminToken = await login(adminCredentials.username, adminCredentials.password);
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
      .send({
        items: [{ product_id: product._id.toString(), quantity: 1, unit_price: 1 }],
        payment_method: 'Cash',
      });

    expect(response.status).toBe(201);
    expect(response.body.sale.total_amount).toBe(100);
    expect((await Product.findById(product._id))?.stock_quantity).toBe(1);
  });

  it.skip('F-02: returns unmarked attendance when no record exists', async () => {
    const response = await request(app)
      .get('/api/admin/attendance/roster?date=2025-01-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.body.roster[0].status).toBe('Unmarked');
  });

  it.skip('F-03: never recalculates or finalizes a paid payroll record', async () => {
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

  it.skip('F-04: only one concurrent sale succeeds for the final stock unit', async () => {
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
      request(app).post('/api/shop/sales').set('Authorization', `Bearer ${adminToken}`).send(payload),
      request(app).post('/api/shop/sales').set('Authorization', `Bearer ${adminToken}`).send(payload),
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

    expect(archivedList.body.employees.map((item: { employee_id: string }) => item.employee_id)).toContain(employeeId);
    expect(defaultList.body.employees.map((item: { employee_id: string }) => item.employee_id)).not.toContain(employeeId);
    expect(roster.body.roster.map((item: { employee_id: string }) => item.employee_id)).not.toContain(employeeId);
    expect(history.body.attendance.map((item: { employee_id: string }) => item.employee_id)).toContain(employeeId);
    expect(payrollHistory.body.payroll.map((item: { employee_id: string }) => item.employee_id)).toContain(employeeId);
    expect(await Attendance.exists({ employee_id: employeeId, date })).not.toBeNull();
    expect(await Payroll.exists({ _id: payroll._id })).not.toBeNull();
    expect(oldSession.status).toBe(401);
  });
});
