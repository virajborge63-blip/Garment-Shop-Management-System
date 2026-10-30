import mongoose from 'mongoose';
import { Attendance } from '../server/models/Attendance.ts';
import { Employee } from '../server/models/Employee.ts';

const validStatuses = new Set(['Present', 'Absent', 'Leave', 'Half Day']);

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function reportSuspiciousAttendance() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI to a read-only, non-production database copy before running this report.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const employeeIds = new Set(await Employee.distinct('employee_id'));
    let findings = 0;
    const records = Attendance.find()
      .select({ employee_id: 1, date: 1, status: 1, working_hours: 1, overtime_hours: 1 })
      .lean()
      .cursor({ batchSize: 500 });

    for await (const record of records) {
      const reasons: string[] = [];
      if (!isValidDate(record.date)) reasons.push('invalid date');
      if (!validStatuses.has(record.status)) reasons.push('invalid status');
      if (!Number.isFinite(record.working_hours) || record.working_hours < 0 || record.working_hours > 16) {
        reasons.push('working hours outside 0-16');
      }
      if (!Number.isFinite(record.overtime_hours) || record.overtime_hours < 0 || record.overtime_hours > 2) {
        reasons.push('overtime hours outside 0-2');
      }
      if (!employeeIds.has(record.employee_id)) reasons.push('employee record missing');

      if (reasons.length > 0) {
        findings++;
        console.log(JSON.stringify({
          attendance_id: record._id.toString(),
          employee_id: record.employee_id,
          date: record.date,
          status: record.status,
          working_hours: record.working_hours,
          overtime_hours: record.overtime_hours,
          reasons,
        }));
      }
    }

    console.log(`Read-only attendance review complete: ${findings} suspicious record(s) found.`);
  } finally {
    await mongoose.disconnect();
  }
}

reportSuspiciousAttendance().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Attendance report failed (${errorName}). No connection details were logged.`);
  process.exitCode = 1;
});
