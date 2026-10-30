import mongoose from 'mongoose';
import { Employee } from '../server/models/Employee.ts';

async function reportSuspiciousEmployeeSalaries() {
  const uri = process.env.AUDIT_MONGODB_URI;
  if (!uri || process.env.AUDIT_NON_PRODUCTION !== 'true') {
    console.error(
      'Set AUDIT_MONGODB_URI to a read-only, non-production database copy and AUDIT_NON_PRODUCTION=true.'
    );
    process.exitCode = 1;
    return;
  }

  try {
    mongoose.set('autoIndex', false);
    await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
    const employees = await Employee.find({
      $or: [{ per_day_salary: { $lte: 0 } }, { per_day_salary: 800 }],
    })
      .select({ _id: 0, employee_id: 1, per_day_salary: 1 })
      .sort({ employee_id: 1 })
      .lean();

    if (employees.length === 0) {
      console.log('No employees with zero, negative, or exactly 800 per-day salary were found.');
      return;
    }

    console.table(employees);
  } finally {
    await mongoose.disconnect();
  }
}

reportSuspiciousEmployeeSalaries().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Salary report failed (${errorName}). No salary values or connection details were logged.`);
  process.exitCode = 1;
});
