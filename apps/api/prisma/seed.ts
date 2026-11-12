/**
 * MedCore HMS — development seed (FICTIONAL DATA ONLY).
 *
 * Run:  npm run db:seed        (from the repo root)
 * Reset and reseed:  npm run db:reset
 *
 * Every person, phone number and medical detail below is invented. Emails use
 * the reserved ".test" domain so they can never reach a real inbox.
 * All accounts share the password in SEED_PASSWORD (default "Demo@12345").
 */
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

import { PrismaClient, type Gender, type Prisma, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_PERMISSIONS } from "../src/common/permissions";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "Demo@12345";

/* ---------------- time helpers (relative to today) ---------------- */
const DAY = 86_400_000;
function at(dayOffset: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const bmi = (w: number, h: number) => Math.round((w / (h / 100) ** 2) * 10) / 10;

/* ---------------- reference data ---------------- */
const MEDICINES: { name: string; category: string; form: string; strength: string; reorder: number; batches: [string, number, number, number, number, number][] }[] = [
  // [batchNo, mfgDaysAgo, expiresInDays, qty, unitCost, mrp]
  { name: "Paracetamol 500 mg", category: "Analgesic", form: "Tablet", strength: "500 mg", reorder: 200, batches: [["PCM-2207", 520, 21, 180, 0.9, 2], ["PCM-2311", 210, 400, 1200, 0.9, 2]] },
  { name: "Amoxicillin 500 mg", category: "Antibiotic", form: "Capsule", strength: "500 mg", reorder: 150, batches: [["AMX-2302", 300, 160, 42, 4.2, 9.5]] },
  { name: "Atorvastatin 20 mg", category: "Cardiac", form: "Tablet", strength: "20 mg", reorder: 120, batches: [["ATV-2309", 240, 380, 640, 3.1, 7.8]] },
  { name: "Amlodipine 5 mg", category: "Cardiac", form: "Tablet", strength: "5 mg", reorder: 100, batches: [["AML-2305", 280, 300, 410, 1.4, 3.6]] },
  { name: "Metformin 500 mg", category: "Antidiabetic", form: "Tablet", strength: "500 mg", reorder: 150, batches: [["MET-2212", 420, -6, 90, 1.1, 2.9], ["MET-2310", 220, 420, 300, 1.1, 2.9]] },
  { name: "Pantoprazole 40 mg", category: "Gastro", form: "Tablet", strength: "40 mg", reorder: 100, batches: [["PAN-2304", 290, 240, 75, 2.4, 6.2]] },
  { name: "Cetirizine 10 mg", category: "Antihistamine", form: "Tablet", strength: "10 mg", reorder: 100, batches: [["CET-2308", 250, 450, 520, 0.6, 1.8]] },
  { name: "Aspirin 75 mg", category: "Cardiac", form: "Tablet", strength: "75 mg", reorder: 120, batches: [["ASP-2306", 270, 55, 260, 0.5, 1.4]] },
  { name: "ORS sachet", category: "Rehydration", form: "Sachet", strength: "21 g", reorder: 80, batches: [["ORS-2301", 330, 200, 34, 6, 19]] },
  { name: "Azithromycin 500 mg", category: "Antibiotic", form: "Tablet", strength: "500 mg", reorder: 60, batches: [["AZI-2310", 200, 510, 160, 14, 32]] },
];

const LAB_TESTS: { name: string; price: number; params: [string, string, number, number][] }[] = [
  { name: "Complete blood count", price: 350, params: [["Hemoglobin", "g/dL", 12, 17.5], ["WBC", "×10³/µL", 4, 11], ["Platelets", "×10³/µL", 150, 450]] },
  { name: "Lipid profile", price: 600, params: [["Total cholesterol", "mg/dL", 125, 200], ["LDL", "mg/dL", 0, 130], ["HDL", "mg/dL", 40, 60], ["Triglycerides", "mg/dL", 0, 150]] },
  { name: "Thyroid profile (T3, T4, TSH)", price: 550, params: [["T3", "ng/dL", 80, 200], ["T4", "µg/dL", 5, 12], ["TSH", "µIU/mL", 0.4, 4]] },
  { name: "HbA1c", price: 450, params: [["HbA1c", "%", 4, 5.6]] },
  { name: "Serum electrolytes", price: 500, params: [["Sodium", "mmol/L", 135, 145], ["Potassium", "mmol/L", 3.5, 5.1], ["Chloride", "mmol/L", 98, 107]] },
  { name: "Troponin I", price: 1200, params: [["Troponin I", "ng/mL", 0, 0.04]] },
  { name: "Fasting blood sugar", price: 120, params: [["Glucose (fasting)", "mg/dL", 70, 100]] },
];

interface HospitalSeed {
  name: string;
  reg: string;
  domain: string; // email domain, e.g. "sunrise.test"
  city: string;
  state: string;
  plan: "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
  fee: number;
  departments: string[];
  admin: [string, string];
  doctors: { first: string; last: string; dept: string; spec: string; exp: number; fee: number; available?: boolean; er?: boolean }[];
  staff: { first: string; last: string; role: Role; dept?: string }[];
  patients: [string, string, Gender, string, string | null, string[]][]; // first, last, gender, dob, blood, allergies
  wards: [string, "GENERAL" | "ICU" | "PRIVATE" | "PEDIATRIC", number][];
  phonePrefix: string;
}

const SUNRISE: HospitalSeed = {
  name: "Sunrise General Hospital",
  reg: "MH-PUN-2019-0042",
  domain: "sunrise.test",
  city: "Pune",
  state: "Maharashtra",
  plan: "PROFESSIONAL",
  fee: 60_000,
  departments: ["Cardiology", "Orthopedics", "General Medicine", "Pediatrics", "Dermatology", "Emergency"],
  admin: ["Rahul", "Mehta"],
  doctors: [
    { first: "Kavita", last: "Sharma", dept: "Cardiology", spec: "Interventional Cardiologist", exp: 14, fee: 900 },
    { first: "Farhan", last: "Ali", dept: "Orthopedics", spec: "Orthopedic Surgeon", exp: 11, fee: 800 },
    { first: "Lakshmi", last: "Menon", dept: "General Medicine", spec: "Internal Medicine", exp: 18, fee: 600 },
    { first: "Sameer", last: "Kapoor", dept: "Pediatrics", spec: "Pediatrician", exp: 9, fee: 700 },
    { first: "Nisha", last: "Bhatt", dept: "Dermatology", spec: "Dermatologist", exp: 7, fee: 750, available: false },
    { first: "Imran", last: "Shaikh", dept: "Emergency", spec: "Emergency Medicine", exp: 12, fee: 1000, er: true },
  ],
  staff: [
    { first: "Meera", last: "Pillai", role: "NURSE", dept: "General Medicine" },
    { first: "Joseph", last: "Thomas", role: "NURSE", dept: "Emergency" },
    { first: "Arjun", last: "Nair", role: "RECEPTIONIST" },
    { first: "Sneha", last: "Joshi", role: "LAB_TECHNICIAN" },
    { first: "Vikram", last: "Desai", role: "PHARMACIST" },
    { first: "Pooja", last: "Iyer", role: "ACCOUNTANT" },
  ],
  patients: [
    ["Rohan", "Kulkarni", "MALE", "1990-04-12", "B+", ["Penicillin"]],
    ["Anil", "Kulkarni", "MALE", "1962-09-30", "O+", []],
    ["Priya", "Das", "FEMALE", "1995-01-21", "A+", []],
    ["Suresh", "Iyer", "MALE", "1958-11-02", "AB+", ["Aspirin"]],
    ["Neha", "Gupta", "FEMALE", "1988-07-17", "B-", []],
    ["Aarav", "Joshi", "MALE", "2017-03-09", "O-", ["Peanuts"]],
    ["Fatima", "Khan", "FEMALE", "1979-12-25", "A-", []],
    ["Deepak", "Verma", "MALE", "1971-06-14", "O+", ["Sulfa drugs"]],
    ["Sunita", "Reddy", "FEMALE", "1966-02-08", "B+", []],
    ["Karan", "Malhotra", "MALE", "1999-10-01", "A+", []],
    ["Ishita", "Banerjee", "FEMALE", "2002-05-27", "AB-", ["Latex"]],
    ["Vivek", "Patil", "MALE", "1984-08-19", "O+", []],
    ["Meenakshi", "Sundaram", "FEMALE", "1951-04-04", "A+", ["Iodine contrast"]],
    ["Harpreet", "Singh", "MALE", "1975-09-23", "B+", []],
  ],
  wards: [["Ward A", "GENERAL", 12], ["Ward B", "GENERAL", 12], ["ICU", "ICU", 6], ["Pediatric", "PEDIATRIC", 6], ["Private", "PRIVATE", 6]],
  phonePrefix: "+9190000",
};

const METRO: HospitalSeed = {
  name: "Metro Heart Institute",
  reg: "TS-HYD-2016-0117",
  domain: "metroheart.test",
  city: "Hyderabad",
  state: "Telangana",
  plan: "ENTERPRISE",
  fee: 150_000,
  departments: ["Cardiology", "Cardiothoracic Surgery", "General Medicine"],
  admin: ["Ravi", "Menon"],
  doctors: [
    { first: "Anjali", last: "Rao", dept: "Cardiology", spec: "Cardiologist", exp: 16, fee: 1200 },
    { first: "Siddharth", last: "Varma", dept: "Cardiothoracic Surgery", spec: "Cardiothoracic Surgeon", exp: 20, fee: 1500 },
    { first: "Fiona", last: "D'Souza", dept: "General Medicine", spec: "Internal Medicine", exp: 8, fee: 700 },
  ],
  staff: [
    { first: "Latha", last: "Krishnan", role: "NURSE", dept: "Cardiology" },
    { first: "Mohit", last: "Jain", role: "RECEPTIONIST" },
    { first: "Ayesha", last: "Siddiqui", role: "LAB_TECHNICIAN" },
    { first: "Gopal", last: "Reddy", role: "PHARMACIST" },
    { first: "Nandini", last: "Shah", role: "ACCOUNTANT" },
  ],
  patients: [
    ["Venkat", "Raman", "MALE", "1955-06-10", "O+", []],
    ["Shalini", "Mishra", "FEMALE", "1972-03-15", "A+", ["Penicillin"]],
    ["Abdul", "Rahman", "MALE", "1968-11-30", "B+", []],
    ["Lavanya", "Gowda", "FEMALE", "1990-08-08", "AB+", []],
    ["Pranav", "Kulkarni", "MALE", "1983-01-19", "O-", []],
    ["Rekha", "Nambiar", "FEMALE", "1960-12-01", "B-", ["Aspirin"]],
  ],
  wards: [["Cardiac Ward", "GENERAL", 10], ["CCU", "ICU", 8], ["Private", "PRIVATE", 6]],
  phonePrefix: "+9190001",
};

const email = (first: string, last: string, domain: string) => `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${domain}`;

/* ------------------------------------------------------------------ */

async function seedHospital(cfg: HospitalSeed, passwordHash: string, withPortalPatient: boolean) {
  const hospital = await prisma.hospital.create({
    data: {
      name: cfg.name,
      registrationNumber: cfg.reg,
      email: `info@${cfg.domain}`,
      phone: `${cfg.phonePrefix}00000`,
      status: "ACTIVE",
      verifiedAt: daysAgo(400),
      createdAt: daysAgo(420),
      address: { create: { line1: "1 Health Avenue (fictional)", city: cfg.city, state: cfg.state, postalCode: "411001" } },
      subscription: { create: { plan: cfg.plan, status: "ACTIVE", monthlyFee: cfg.fee, currentEnd: daysFromNow(20) } },
    },
  });
  const hid = hospital.id;

  // Departments
  const deps = new Map<string, string>();
  for (const name of cfg.departments) deps.set(name, (await prisma.department.create({ data: { hospitalId: hid, name } })).id);

  // Admin & staff
  const mkUser = (first: string, last: string, role: Role, dept?: string) =>
    prisma.user.create({
      data: {
        email: email(first, last, cfg.domain),
        passwordHash,
        firstName: first,
        lastName: last,
        role,
        hospitalId: hid,
        departmentId: dept ? deps.get(dept) : undefined,
        emailVerified: true,
        phone: `${cfg.phonePrefix}${String(Math.floor(Math.random() * 90000) + 10000)}`,
      },
    });
  const admin = await mkUser(cfg.admin[0], cfg.admin[1], "HOSPITAL_ADMIN");
  const staff = new Map<Role, { id: string; name: string }>();
  for (const s of cfg.staff) {
    const u = await mkUser(s.first, s.last, s.role, s.dept);
    if (!staff.has(s.role)) staff.set(s.role, { id: u.id, name: `${s.first} ${s.last}` });
  }

  // Doctors with weekly availability
  const doctors: { id: string; userId: string; name: string; fee: number }[] = [];
  for (const [i, d] of cfg.doctors.entries()) {
    const u = await mkUser(d.first, d.last, "DOCTOR", d.dept);
    const doc = await prisma.doctor.create({
      data: {
        userId: u.id,
        hospitalId: hid,
        departmentId: deps.get(d.dept)!,
        specialization: d.spec,
        qualification: "MBBS, MD (fictional)",
        licenseNumber: `${cfg.reg.slice(0, 2)}-MC-${10_000 + i * 137}`,
        experienceYears: d.exp,
        consultationFee: d.fee,
        isAvailable: d.available ?? true,
        availability: {
          create: d.er
            ? [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "08:00", endTime: "20:00", slotMinutes: 20 }))
            : [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
                { weekday, startTime: "09:00", endTime: "13:00", slotMinutes: 15 },
                { weekday, startTime: "14:00", endTime: "17:00", slotMinutes: 15 },
              ]),
        },
      },
    });
    doctors.push({ id: doc.id, userId: u.id, name: `Dr. ${d.first} ${d.last}`, fee: d.fee });
  }

  // Patients (+ one portal account for the first patient)
  const patients: { id: string; name: string; mrn: string }[] = [];
  for (const [i, [first, last, gender, dob, blood, allergies]] of cfg.patients.entries()) {
    const portalUserId =
      withPortalPatient && i === 0
        ? (
            await prisma.user.create({
              data: {
                email: `${first}.${last}@patient.test`.toLowerCase(),
                passwordHash,
                firstName: first,
                lastName: last,
                role: "PATIENT",
                hospitalId: hid,
                emailVerified: true,
              },
            })
          ).id
        : null;
    const p = await prisma.patient.create({
      data: {
        hospitalId: hid,
        mrn: `MC-${String(100101 + i)}`,
        firstName: first,
        lastName: last,
        gender,
        dateOfBirth: new Date(dob),
        phone: `${cfg.phonePrefix}${String(10000 + i * 137).padStart(5, "0")}`,
        bloodGroup: blood,
        createdAt: daysAgo(30 + i * 11),
        allergies: { create: allergies.map((substance) => ({ substance, severity: "moderate" })) },
        ...(portalUserId
          ? {
              email: `${first}.${last}@patient.test`.toLowerCase(),
              userId: portalUserId,
              vaccinations: {
                create: [
                  { vaccine: "COVID-19 (Covishield)", dose: "Booster", givenOn: daysAgo(620) },
                  { vaccine: "Tetanus toxoid (Td)", dose: "Booster", givenOn: daysAgo(900) },
                  { vaccine: "Hepatitis B", dose: "3 of 3", givenOn: daysAgo(4200) },
                ],
              },
              familyHistory: {
                create: [
                  { relation: "Father", condition: "Hypertension, type 2 diabetes" },
                  { relation: "Mother", condition: "Hypothyroidism" },
                ],
              },
            }
          : {}),
      },
    });
    patients.push({ id: p.id, name: `${first} ${last}`, mrn: p.mrn });
  }

  const pat = (i: number) => patients[i % patients.length];

  // Wards & beds (some occupied by the first patients)
  let occupant = 3;
  for (const [ward, type, count] of cfg.wards) {
    const w = await prisma.ward.create({ data: { hospitalId: hid, name: ward } });
    for (let i = 1; i <= count; i++) {
      const seed = (ward.length * 7 + i * 3) % 10;
      const status = seed < 6 ? "OCCUPIED" : seed < 8 ? "AVAILABLE" : seed < 9 ? "CLEANING" : "RESERVED";
      const patientId = status === "OCCUPIED" && occupant < patients.length ? patients[occupant++].id : undefined;
      await prisma.bed.create({
        data: { wardId: w.id, label: `${ward.replace(/[^A-Z]/g, "") || ward.slice(0, 2).toUpperCase()}-${String(i).padStart(2, "0")}`, type, status: patientId ? "OCCUPIED" : status === "OCCUPIED" ? "AVAILABLE" : status, patientId },
      });
    }
  }

  // Pharmacy
  const medicines = new Map<string, string>();
  for (const m of MEDICINES) {
    const med = await prisma.medicine.create({
      data: {
        hospitalId: hid,
        name: m.name,
        category: m.category,
        form: m.form,
        strength: m.strength,
        reorderLevel: m.reorder,
        batches: {
          create: m.batches.map(([batchNo, mfg, exp, quantity, unitCost, mrp]) => ({
            batchNo,
            manufacturedOn: daysAgo(mfg),
            expiresOn: daysFromNow(exp),
            quantity,
            unitCost,
            mrp,
            movements: { create: { type: "RECEIVED", quantity, performedBy: staff.get("PHARMACIST")!.id, reference: "Opening stock" } },
          })),
        },
      },
    });
    medicines.set(m.name, med.id);
  }

  // Lab catalogue
  const tests = new Map<string, { id: string; params: [string, string, number, number][] }>();
  for (const t of LAB_TESTS) {
    const row = await prisma.labTest.create({
      data: {
        hospitalId: hid,
        name: t.name,
        price: t.price,
        parameters: { create: t.params.map(([name, unit, refLow, refHigh], sortOrder) => ({ name, unit, refLow, refHigh, sortOrder })) },
      },
    });
    tests.set(t.name, { id: row.id, params: t.params });
  }

  // Appointments: today, upcoming and past
  const appt = async (pi: number, di: number, day: number, time: string, status: Prisma.AppointmentCreateInput["status"], reason: string, emergency = false) => {
    const startsAt = at(day, time);
    const mins = di === 5 ? 20 : 15;
    return prisma.appointment.create({
      data: {
        hospital: { connect: { id: hid } },
        patient: { connect: { id: patients[pi % patients.length].id } },
        doctor: { connect: { id: doctors[di % doctors.length].id } },
        startsAt,
        endsAt: new Date(startsAt.getTime() + mins * 60_000),
        status,
        reason,
        emergency,
        checkedInAt: status === "IN_PROGRESS" || status === "COMPLETED" ? new Date(startsAt.getTime() - 10 * 60_000) : null,
      },
    });
  };
  await appt(1, 0, 0, "09:00", "COMPLETED", "Follow-up: hypertension");
  await appt(7, 0, 0, "09:30", "IN_PROGRESS", "Chest discomfort on exertion");
  await appt(3, 0, 0, "10:00", "CONFIRMED", "Acute chest pain", true);
  await appt(12, 0, 0, "10:30", "CONFIRMED", "Palpitations");
  await appt(8, 0, 0, "11:30", "PENDING", "Annual cardiac check-up");
  await appt(2, 0, 0, "12:00", "PENDING", "ECG review");
  await appt(4, 1, 0, "09:15", "COMPLETED", "Knee pain");
  await appt(9, 1, 0, "10:45", "CONFIRMED", "Ankle sprain");
  await appt(6, 2, 0, "09:45", "NO_SHOW", "Fever and fatigue");
  await appt(10, 2, 0, "11:00", "CONFIRMED", "Thyroid follow-up");
  await appt(5, 3, 0, "10:15", "IN_PROGRESS", "Vaccination (MMR booster)");
  await appt(11, 2, 0, "15:00", "CANCELLED", "General consultation");
  await appt(0, 0, 1, "11:30", "CONFIRMED", "Follow-up: lipid profile review");
  await appt(0, 2, 9, "16:00", "PENDING", "General check-up");
  await appt(2, 0, 1, "11:45", "CONFIRMED", "Follow-up");
  await appt(1, 0, 3, "10:00", "CONFIRMED", "BP review");
  const pastVisit = await appt(0, 0, -3, "10:00", "COMPLETED", "Chest pain evaluation");
  await appt(0, 3, -48, "12:00", "COMPLETED", "Viral fever");

  // Medical record for the portal patient's last visit (append-only rows)
  const doctorUser = doctors[0];
  const nurse = staff.get("NURSE")!;
  const rec = await prisma.medicalRecord.create({
    data: { hospitalId: hid, patientId: pat(0).id, appointmentId: pastVisit.id, openedById: doctorUser.userId, createdAt: daysAgo(3) },
  });
  await prisma.vital.create({
    data: { recordId: rec.id, recordedById: nurse.id, recordedAt: daysAgo(3), systolic: 134, diastolic: 86, pulse: 82, temperatureC: 36.8, spo2: 98, heightCm: 176, weightKg: 81, bmi: bmi(81, 176) },
  });
  await prisma.diagnosis.create({ data: { recordId: rec.id, code: "I10", description: "Essential (primary) hypertension", type: "FINAL", recordedById: doctorUser.userId, recordedAt: daysAgo(3) } });
  await prisma.clinicalNote.create({
    data: {
      recordId: rec.id,
      authorId: doctorUser.userId,
      createdAt: daysAgo(3),
      symptoms: "Intermittent chest tightness for 2 weeks, mild headaches. No radiation of pain.",
      treatmentPlan: "Start amlodipine 5 mg OD. Lipid profile and thyroid panel. Low-salt diet, 30 min walk daily. Review in 1 week.",
    },
  });

  // Prescriptions
  const rxItem = (name: string, dosage: string, frequency: string, durationDays: number, quantity: number, instructions?: string) => ({
    medicineId: medicines.get(name)!, dosage, frequency, durationDays, quantity, instructions,
  });
  await prisma.prescription.create({
    data: { hospitalId: hid, code: "RX-1038", patientId: pat(0).id, doctorId: doctors[0].id, recordId: rec.id, status: "DISPENSED", issuedAt: daysAgo(3),
      items: { create: [rxItem("Amlodipine 5 mg", "5 mg", "1-0-0", 30, 30, "Morning"), rxItem("Cetirizine 10 mg", "10 mg", "0-0-1", 5, 5)].map((i) => ({ ...i, dispensedQty: i.quantity })) } },
  });
  await prisma.prescription.create({
    data: { hospitalId: hid, code: "RX-1043", patientId: pat(1).id, doctorId: doctors[0].id, issuedAt: minutesAgo(32),
      items: { create: [rxItem("Atorvastatin 20 mg", "20 mg", "0-0-1", 30, 30, "After dinner"), rxItem("Aspirin 75 mg", "75 mg", "0-1-0", 30, 30, "After lunch")] } },
  });
  await prisma.prescription.create({
    data: { hospitalId: hid, code: "RX-1042", patientId: pat(4).id, doctorId: doctors[1].id, issuedAt: minutesAgo(60),
      items: { create: [rxItem("Paracetamol 500 mg", "500 mg", "1-1-1", 5, 15, "After meals"), rxItem("Pantoprazole 40 mg", "40 mg", "1-0-0", 5, 5, "Before breakfast")] } },
  });

  // Lab orders across the workflow, with results that include abnormal values
  const lab = staff.get("LAB_TECHNICIAN")!;
  const order = async (code: string, pi: number, testName: string, status: Prisma.LabOrderCreateInput["status"], priority: "ROUTINE" | "URGENT", orderedAt: Date, values?: number[]) => {
    const t = tests.get(testName)!;
    await prisma.labOrder.create({
      data: {
        hospital: { connect: { id: hid } },
        code,
        patient: { connect: { id: pat(pi).id } },
        labTest: { connect: { id: t.id } },
        orderedBy: { connect: { id: doctors[0].id } },
        priority,
        status,
        orderedAt,
        collectedAt: status === "ORDERED" ? null : orderedAt,
        approvedAt: status === "APPROVED" ? new Date(orderedAt.getTime() + 3_600_000) : null,
        approvedById: status === "APPROVED" ? lab.id : null,
        results: values
          ? {
              create: t.params.map(([parameter, unit, refLow, refHigh], i) => ({
                parameter, unit, refLow, refHigh, value: values[i], isAbnormal: values[i] < refLow || values[i] > refHigh, enteredById: lab.id, enteredAt: orderedAt,
              })),
            }
          : undefined,
      },
    });
  };
  await order("LAB-2024", 0, "Complete blood count", "APPROVED", "ROUTINE", daysAgo(3), [14.6, 11.8, 210]);
  await order("LAB-2031", 1, "Lipid profile", "APPROVED", "ROUTINE", minutesAgo(300), [238, 162, 41, 176]);
  await order("LAB-2032", 2, "Complete blood count", "RESULT_ENTERED", "ROUTINE", minutesAgo(180), [11.2, 7.4, 265]);
  await order("LAB-2033", 0, "Thyroid profile (T3, T4, TSH)", "ORDERED", "URGENT", minutesAgo(25));
  await order("LAB-2034", 3, "Troponin I", "PROCESSING", "URGENT", minutesAgo(50));
  await order("LAB-2035", 7, "HbA1c", "SAMPLE_COLLECTED", "ROUTINE", minutesAgo(120));
  await order("LAB-2037", 12, "Serum electrolytes", "RESULT_ENTERED", "ROUTINE", minutesAgo(240), [138, 5.6, 101]);

  // Invoices & payments
  const accountant = staff.get("ACCOUNTANT")!;
  type Line = { category: Prisma.InvoiceItemCreateInput["category"]; description: string; quantity: number; unitPrice: number; taxRate: number };
  const consult = (fee: number): Line => ({ category: "CONSULTATION", description: "Consultation", quantity: 1, unitPrice: fee, taxRate: 0 });
  const labLine = (name: string, price: number): Line => ({ category: "LAB", description: name, quantity: 1, unitPrice: price, taxRate: 0 });
  const pharm = (name: string, qty: number, price: number): Line => ({ category: "PHARMACY", description: name, quantity: qty, unitPrice: price, taxRate: 12 });
  const room = (days: number): Line => ({ category: "ROOM", description: "General ward bed", quantity: days, unitPrice: 1800, taxRate: 5 });
  let invNo = 300;
  const invoice = async (pi: number, daysOld: number, lines: Line[], paidFraction: number, method?: "CASH" | "CARD" | "UPI" | "INSURANCE", voided = false) => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const tax = Math.round(lines.reduce((s, l) => s + (l.quantity * l.unitPrice * l.taxRate) / 100, 0) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const paid = Math.round(total * paidFraction * 100) / 100;
    invNo++;
    const inv = await prisma.invoice.create({
      data: {
        hospitalId: hid,
        number: `INV-${new Date().getFullYear()}-${String(invNo).padStart(4, "0")}`,
        patientId: pat(pi).id,
        status: voided ? "VOID" : paid >= total ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED",
        subtotal, tax, total, amountPaid: paid,
        issuedAt: daysAgo(daysOld), dueAt: daysAgo(daysOld - 15), createdById: accountant.id,
        items: { create: lines },
        payments: paid > 0 && method
          ? { create: { amount: paid, method, status: "SUCCEEDED", receiptNumber: `RCPT-${cfg.reg.slice(0, 2)}-${invNo}`, recordedById: accountant.id, confirmedAt: daysAgo(daysOld) } }
          : undefined,
      },
    });
    return inv;
  };
  await invoice(0, 3, [consult(900), labLine("Complete blood count", 350), pharm("Amlodipine 5 mg", 30, 3.6), pharm("Cetirizine 10 mg", 5, 1.8)], 0);
  await invoice(0, 48, [consult(700), pharm("Paracetamol 500 mg", 9, 2)], 1, "UPI");
  await invoice(1, 0, [consult(900), labLine("Lipid profile", 600)], 0);
  const er = await invoice(3, 0, [consult(1000), labLine("Troponin I", 1200), room(1)], 0.5, "CASH");
  await invoice(4, 0, [consult(800), pharm("Paracetamol 500 mg", 15, 2), pharm("Pantoprazole 40 mg", 5, 6.2)], 1, "CARD");
  await invoice(9, 1, [consult(800)], 1, "CASH");
  await invoice(7, 2, [consult(900), labLine("HbA1c", 450)], 1, "UPI");
  const longStay = await invoice(12, 4, [consult(900), labLine("Serum electrolytes", 500), room(3)], 0);
  const settled = await invoice(13, 6, [consult(800), room(2)], 1, "INSURANCE");
  await invoice(8, 9, [consult(900), labLine("ECG", 300)], 1, "CASH");
  await invoice(10, 12, [consult(600)], 0, undefined, true);

  // Insurance claims
  await prisma.insuranceClaim.createMany({
    data: [
      { hospitalId: hid, claimNo: `CLM-${cfg.reg.slice(0, 2)}-7781`, invoiceId: settled.id, insurer: "Sample Health Insurance Co.", policyNo: "POL-000111", amount: settled.total, status: "SETTLED", submittedAt: daysAgo(6) },
      { hospitalId: hid, claimNo: `CLM-${cfg.reg.slice(0, 2)}-7779`, invoiceId: longStay.id, insurer: "Example General Insurance", policyNo: "POL-000222", amount: longStay.total, status: "UNDER_REVIEW", submittedAt: daysAgo(3) },
      { hospitalId: hid, claimNo: `CLM-${cfg.reg.slice(0, 2)}-7783`, invoiceId: er.id, insurer: "Demo Assurance Ltd.", policyNo: "POL-000333", amount: er.total, status: "DRAFT" },
    ],
  });

  // Nursing notes & notifications
  await prisma.medicationAdministration.createMany({
    data: [
      { hospitalId: hid, patientId: pat(3).id, medicine: "Clopidogrel 75 mg (aspirin allergy)", dose: "1 tab", givenById: nurse.id, givenAt: minutesAgo(60), note: "Allergy to aspirin verified" },
      { hospitalId: hid, patientId: pat(12).id, medicine: "Amlodipine 5 mg", dose: "1 tab", givenById: nurse.id, givenAt: minutesAgo(180) },
    ],
  });
  await prisma.notification.createMany({
    data: [
      { hospitalId: hid, userId: doctors[0].userId, type: "EMERGENCY_APPOINTMENT", title: "Emergency appointment", body: `${pat(3).name} (chest pain) added to your queue at 10:00.`, createdAt: minutesAgo(6) },
      { hospitalId: hid, userId: doctors[0].userId, type: "LAB_REPORT_APPROVED", title: "Lab report approved", body: `Lipid profile for ${pat(1).name} is ready to review.`, createdAt: minutesAgo(48) },
      { hospitalId: hid, userId: staff.get("PHARMACIST")!.id, type: "LOW_STOCK", title: "Low stock", body: "Amoxicillin 500 mg is below its reorder level (42 left).", createdAt: minutesAgo(15) },
      { hospitalId: hid, userId: admin.id, type: "LOW_STOCK", title: "Medicines below reorder level", body: "Pharmacy stock needs attention.", createdAt: minutesAgo(15) },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { hospitalId: hid, actorId: admin.id, actorRole: "HOSPITAL_ADMIN", action: "STAFF_CREATE", entity: doctors[1]?.name ?? "Doctor", createdAt: daysAgo(1), ip: "10.0.4.2" },
      { hospitalId: hid, actorId: lab.id, actorRole: "LAB_TECHNICIAN", action: "LAB_RESULT_APPROVE", entity: "LAB-2031", createdAt: minutesAgo(240), ip: "10.0.4.33" },
    ],
  });

  return { hospital, patients, portalEmail: withPortalPatient ? `${cfg.patients[0][0]}.${cfg.patients[0][1]}@patient.test`.toLowerCase() : null, domain: cfg.domain };
}

async function main() {
  // Always sync the role → permission matrix (safe to re-run after adding permissions).
  await prisma.rolePermission.createMany({
    data: Object.entries(ROLE_PERMISSIONS).flatMap(([role, perms]) => perms.map((permission) => ({ role: role as Role, permission }))),
    skipDuplicates: true,
  });

  if (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } })) {
    console.log("Database already seeded. Run `npm run db:reset` to wipe and reseed.");
    return;
  }

  console.log("Seeding MedCore HMS with fictional data…");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.user.create({
    data: { email: "superadmin@medcore.test", passwordHash, firstName: "Ananya", lastName: "Rao", role: "SUPER_ADMIN", emailVerified: true },
  });

  const sunrise = await seedHospital(SUNRISE, passwordHash, true);
  await seedHospital(METRO, passwordHash, false);

  // A hospital awaiting verification (its admin can't sign in until verified)
  await prisma.hospital.create({
    data: {
      name: "Lakeview Multispeciality",
      registrationNumber: "MP-BPL-2026-0310",
      email: "info@lakeview.test",
      phone: "+919000200000",
      address: { create: { line1: "22 Lake Road (fictional)", city: "Bhopal", state: "Madhya Pradesh", postalCode: "462001" } },
      subscription: { create: { plan: "PROFESSIONAL", status: "TRIAL", monthlyFee: 60_000, currentEnd: daysFromNow(29) } },
      users: { create: { email: "admin@lakeview.test", passwordHash, firstName: "Kiran", lastName: "Bose", role: "HOSPITAL_ADMIN", emailVerified: true } },
    },
  });

  const d = sunrise.domain;
  console.log("\nDone. Fictional accounts (password: %s):", PASSWORD);
  console.table([
    { role: "Super Admin", email: "superadmin@medcore.test" },
    { role: "Hospital Admin", email: `rahul.mehta@${d}` },
    { role: "Doctor", email: `kavita.sharma@${d}` },
    { role: "Nurse", email: `meera.pillai@${d}` },
    { role: "Receptionist", email: `arjun.nair@${d}` },
    { role: "Lab Technician", email: `sneha.joshi@${d}` },
    { role: "Pharmacist", email: `vikram.desai@${d}` },
    { role: "Accountant", email: `pooja.iyer@${d}` },
    { role: "Patient", email: sunrise.portalEmail },
    { role: "Admin, other hospital", email: "ravi.menon@metroheart.test" },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
