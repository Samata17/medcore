/**
 * SAMPLE DATA — a fictional hospital used only in demo mode.
 * Names, phone numbers and medical details are invented. Phone numbers use the
 * reserved-looking 90000 prefix so they can't be mistaken for real ones.
 *
 * The dataset lives in memory for the current browser tab. Demo actions
 * (check-in, approve result, dispense…) change it so flows can be explored,
 * but nothing is sent to or saved on a server.
 */
import type {
  AppointmentRow,
  AuditLogRow,
  BedRow,
  ClaimRow,
  DepartmentRow,
  DiagnosisRow,
  DoctorRow,
  EncounterNote,
  HospitalRow,
  InvoiceItemRow,
  InvoiceRow,
  LabOrderRow,
  MedicationNote,
  MedicineBatchRow,
  PatientRow,
  PrescriptionRow,
  StaffRow,
  VitalRow,
} from "@medcore/types";
import { invoiceTotals } from "@medcore/types";
import { daysAgo, daysFromNow, hoursAgo, minutesAgo, todayAt } from "@/lib/demo/time";
import { calculateBmi } from "@/lib/format";

export const DEPARTMENTS: DepartmentRow[] = [
  { id: "dep-card", name: "Cardiology", headDoctor: "Dr. Kavita Sharma", doctors: 4, patientsToday: 38 },
  { id: "dep-ortho", name: "Orthopedics", headDoctor: "Dr. Farhan Ali", doctors: 3, patientsToday: 27 },
  { id: "dep-gen", name: "General Medicine", headDoctor: "Dr. Lakshmi Menon", doctors: 6, patientsToday: 41 },
  { id: "dep-peds", name: "Pediatrics", headDoctor: "Dr. Sameer Kapoor", doctors: 3, patientsToday: 19 },
  { id: "dep-derm", name: "Dermatology", headDoctor: "Dr. Nisha Bhatt", doctors: 2, patientsToday: 11 },
  { id: "dep-er", name: "Emergency", headDoctor: "Dr. Imran Shaikh", doctors: 5, patientsToday: 6 },
];

export const DOCTORS: DoctorRow[] = [
  { id: "doc-1", name: "Dr. Kavita Sharma", specialization: "Interventional Cardiologist", departmentId: "dep-card", department: "Cardiology", experienceYears: 14, consultationFee: 900, available: true },
  { id: "doc-2", name: "Dr. Farhan Ali", specialization: "Orthopedic Surgeon", departmentId: "dep-ortho", department: "Orthopedics", experienceYears: 11, consultationFee: 800, available: true },
  { id: "doc-3", name: "Dr. Lakshmi Menon", specialization: "Internal Medicine", departmentId: "dep-gen", department: "General Medicine", experienceYears: 18, consultationFee: 600, available: true },
  { id: "doc-4", name: "Dr. Sameer Kapoor", specialization: "Pediatrician", departmentId: "dep-peds", department: "Pediatrics", experienceYears: 9, consultationFee: 700, available: true },
  { id: "doc-5", name: "Dr. Nisha Bhatt", specialization: "Dermatologist", departmentId: "dep-derm", department: "Dermatology", experienceYears: 7, consultationFee: 750, available: false },
  { id: "doc-6", name: "Dr. Imran Shaikh", specialization: "Emergency Medicine", departmentId: "dep-er", department: "Emergency", experienceYears: 12, consultationFee: 1000, available: true },
];

const P = (
  n: number,
  name: string,
  gender: PatientRow["gender"],
  dob: string,
  blood: PatientRow["bloodGroup"],
  allergies: string[],
  lastVisitDays?: number,
): PatientRow => ({
  id: `pat-${n}`,
  mrn: `MC-${String(100100 + n)}`,
  name,
  gender,
  dateOfBirth: dob,
  phone: `+91 90000 ${String(10000 + n * 137).slice(0, 5)}`,
  bloodGroup: blood,
  allergies,
  lastVisit: lastVisitDays !== undefined ? daysAgo(lastVisitDays) : undefined,
  createdAt: daysAgo(30 + n * 11),
});

function seedPatients(): PatientRow[] {
  return [
    P(1, "Rohan Kulkarni", "MALE", "1990-04-12", "B+", ["Penicillin"], 3),
    P(2, "Anil Kulkarni", "MALE", "1962-09-30", "O+", [], 0),
    P(3, "Priya Das", "FEMALE", "1995-01-21", "A+", [], 6),
    P(4, "Suresh Iyer", "MALE", "1958-11-02", "AB+", ["Aspirin"], 0),
    P(5, "Neha Gupta", "FEMALE", "1988-07-17", "B-", [], 14),
    P(6, "Aarav Joshi", "MALE", "2017-03-09", "O-", ["Peanuts"], 1),
    P(7, "Fatima Khan", "FEMALE", "1979-12-25", "A-", [], 22),
    P(8, "Deepak Verma", "MALE", "1971-06-14", "O+", ["Sulfa drugs"], 2),
    P(9, "Sunita Reddy", "FEMALE", "1966-02-08", "B+", [], 40),
    P(10, "Karan Malhotra", "MALE", "1999-10-01", "A+", [], 9),
    P(11, "Ishita Banerjee", "FEMALE", "2002-05-27", "AB-", ["Latex"], 5),
    P(12, "Vivek Patil", "MALE", "1984-08-19", "O+", [], 60),
    P(13, "Meenakshi Sundaram", "FEMALE", "1951-04-04", "A+", ["Iodine contrast"], 1),
    P(14, "Harpreet Singh", "MALE", "1975-09-23", "B+", [], 12),
  ];
}

function appt(
  id: number,
  patient: PatientRow,
  doctor: DoctorRow,
  time: string,
  status: AppointmentRow["status"],
  reason: string,
  emergency = false,
  dayOffset = 0,
): AppointmentRow {
  const startsAt = todayAt(time, dayOffset);
  return {
    id: `apt-${id}`,
    patientId: patient.id,
    patientName: patient.name,
    patientMrn: patient.mrn,
    doctorId: doctor.id,
    doctorName: doctor.name,
    department: doctor.department,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 15 * 60_000).toISOString(),
    status,
    reason,
    emergency,
    checkedInAt: status === "IN_PROGRESS" || status === "COMPLETED" ? minutesAgo(40) : undefined,
  };
}

function seedAppointments(p: PatientRow[]): AppointmentRow[] {
  const [d1, d2, d3, d4, , d6] = DOCTORS;
  return [
    appt(1, p[1], d1, "09:00", "COMPLETED", "Follow-up: hypertension"),
    appt(2, p[7], d1, "09:30", "IN_PROGRESS", "Chest discomfort on exertion"),
    appt(3, p[3], d1, "10:00", "CONFIRMED", "Acute chest pain", true),
    appt(4, p[12], d1, "10:30", "CONFIRMED", "Palpitations"),
    appt(5, p[8], d1, "11:30", "PENDING", "Annual cardiac check-up"),
    appt(6, p[2], d1, "12:00", "PENDING", "ECG review"),
    appt(7, p[4], d2, "09:15", "COMPLETED", "Knee pain"),
    appt(8, p[9], d2, "10:45", "CONFIRMED", "Ankle sprain"),
    appt(9, p[13], d2, "14:30", "PENDING", "Lower back pain"),
    appt(10, p[6], d3, "09:45", "NO_SHOW", "Fever and fatigue"),
    appt(11, p[10], d3, "11:00", "CONFIRMED", "Thyroid follow-up"),
    appt(12, p[5], d4, "10:15", "IN_PROGRESS", "Vaccination (MMR booster)"),
    appt(13, p[11], d3, "15:00", "CANCELLED", "General consultation"),
    appt(14, p[3], d6, "08:40", "COMPLETED", "Triage assessment", true),
    // Upcoming / past for patient + follow-ups
    appt(15, p[0], d1, "11:30", "CONFIRMED", "Follow-up: lipid profile review", false, 1),
    appt(16, p[0], d3, "16:00", "PENDING", "General check-up", false, 9),
    appt(17, p[0], d1, "10:00", "COMPLETED", "Chest pain evaluation", false, -3),
    appt(18, p[0], d4, "12:00", "COMPLETED", "Viral fever", false, -48),
    appt(19, p[2], d1, "11:30", "CONFIRMED", "Follow-up", false, 1),
    appt(20, p[1], d1, "10:00", "CONFIRMED", "BP review", false, 3),
    appt(21, p[12], d1, "09:30", "PENDING", "Holter results", false, 5),
  ];
}

function seedLabOrders(p: PatientRow[]): LabOrderRow[] {
  return [
    { id: "lab-1", code: "LAB-2031", patientId: p[1].id, patientName: p[1].name, testName: "Lipid profile", orderedBy: "Dr. Kavita Sharma", orderedAt: hoursAgo(5), priority: "ROUTINE", status: "APPROVED", approvedBy: "Sneha Joshi",
      results: [
        { parameter: "Total cholesterol", value: 238, unit: "mg/dL", refLow: 125, refHigh: 200 },
        { parameter: "LDL", value: 162, unit: "mg/dL", refLow: 0, refHigh: 130 },
        { parameter: "HDL", value: 41, unit: "mg/dL", refLow: 40, refHigh: 60 },
        { parameter: "Triglycerides", value: 176, unit: "mg/dL", refLow: 0, refHigh: 150 },
      ] },
    { id: "lab-2", code: "LAB-2032", patientId: p[2].id, patientName: p[2].name, testName: "Complete blood count", orderedBy: "Dr. Lakshmi Menon", orderedAt: hoursAgo(3), priority: "ROUTINE", status: "RESULT_ENTERED",
      results: [
        { parameter: "Hemoglobin", value: 11.2, unit: "g/dL", refLow: 12, refHigh: 15.5 },
        { parameter: "WBC", value: 7.4, unit: "×10³/µL", refLow: 4, refHigh: 11 },
        { parameter: "Platelets", value: 265, unit: "×10³/µL", refLow: 150, refHigh: 450 },
      ] },
    { id: "lab-3", code: "LAB-2033", patientId: p[0].id, patientName: p[0].name, testName: "Thyroid profile (T3, T4, TSH)", orderedBy: "Dr. Kavita Sharma", orderedAt: minutesAgo(25), priority: "URGENT", status: "ORDERED" },
    { id: "lab-4", code: "LAB-2034", patientId: p[3].id, patientName: p[3].name, testName: "Troponin I", orderedBy: "Dr. Imran Shaikh", orderedAt: minutesAgo(50), priority: "URGENT", status: "PROCESSING" },
    { id: "lab-5", code: "LAB-2035", patientId: p[7].id, patientName: p[7].name, testName: "HbA1c", orderedBy: "Dr. Kavita Sharma", orderedAt: hoursAgo(2), priority: "ROUTINE", status: "SAMPLE_COLLECTED" },
    { id: "lab-6", code: "LAB-2036", patientId: p[10].id, patientName: p[10].name, testName: "Thyroid profile (T3, T4, TSH)", orderedBy: "Dr. Lakshmi Menon", orderedAt: hoursAgo(1), priority: "ROUTINE", status: "ORDERED" },
    { id: "lab-7", code: "LAB-2037", patientId: p[12].id, patientName: p[12].name, testName: "Serum electrolytes", orderedBy: "Dr. Kavita Sharma", orderedAt: hoursAgo(4), priority: "ROUTINE", status: "RESULT_ENTERED",
      results: [
        { parameter: "Sodium", value: 138, unit: "mmol/L", refLow: 135, refHigh: 145 },
        { parameter: "Potassium", value: 5.6, unit: "mmol/L", refLow: 3.5, refHigh: 5.1 },
        { parameter: "Chloride", value: 101, unit: "mmol/L", refLow: 98, refHigh: 107 },
      ] },
    { id: "lab-8", code: "LAB-2024", patientId: p[0].id, patientName: p[0].name, testName: "Complete blood count", orderedBy: "Dr. Sameer Kapoor", orderedAt: daysAgo(3), priority: "ROUTINE", status: "APPROVED", approvedBy: "Sneha Joshi",
      results: [
        { parameter: "Hemoglobin", value: 14.6, unit: "g/dL", refLow: 13.5, refHigh: 17.5 },
        { parameter: "WBC", value: 11.8, unit: "×10³/µL", refLow: 4, refHigh: 11 },
        { parameter: "Platelets", value: 210, unit: "×10³/µL", refLow: 150, refHigh: 450 },
      ] },
    { id: "lab-9", code: "LAB-2038", patientId: p[5].id, patientName: p[5].name, testName: "Urine routine", orderedBy: "Dr. Sameer Kapoor", orderedAt: minutesAgo(15), priority: "ROUTINE", status: "ORDERED" },
  ];
}

function batch(id: number, medicineId: string, name: string, category: string, batchNo: string, mfgDaysAgo: number, expDaysFromNow: number, qty: number, reorder: number, cost: number, mrp: number): MedicineBatchRow {
  return { id: `bat-${id}`, medicineId, medicineName: name, category, batchNo, manufacturedOn: daysAgo(mfgDaysAgo), expiresOn: daysFromNow(expDaysFromNow), quantity: qty, reorderLevel: reorder, unitCost: cost, mrp };
}

function seedBatches(): MedicineBatchRow[] {
  return [
    batch(1, "med-pcm", "Paracetamol 500 mg", "Analgesic", "PCM-2207", 520, 21, 180, 200, 0.9, 2),
    batch(2, "med-pcm", "Paracetamol 500 mg", "Analgesic", "PCM-2311", 210, 400, 1200, 200, 0.9, 2),
    batch(3, "med-amx", "Amoxicillin 500 mg", "Antibiotic", "AMX-2302", 300, 160, 42, 150, 4.2, 9.5),
    batch(4, "med-ator", "Atorvastatin 20 mg", "Cardiac", "ATV-2309", 240, 380, 640, 120, 3.1, 7.8),
    batch(5, "med-aml", "Amlodipine 5 mg", "Cardiac", "AML-2305", 280, 300, 410, 100, 1.4, 3.6),
    batch(6, "med-met", "Metformin 500 mg", "Antidiabetic", "MET-2212", 420, -6, 90, 150, 1.1, 2.9),
    batch(7, "med-met", "Metformin 500 mg", "Antidiabetic", "MET-2310", 220, 420, 300, 150, 1.1, 2.9),
    batch(8, "med-pan", "Pantoprazole 40 mg", "Gastro", "PAN-2304", 290, 240, 75, 100, 2.4, 6.2),
    batch(9, "med-cet", "Cetirizine 10 mg", "Antihistamine", "CET-2308", 250, 450, 520, 100, 0.6, 1.8),
    batch(10, "med-asp", "Aspirin 75 mg", "Cardiac", "ASP-2306", 270, 55, 260, 120, 0.5, 1.4),
    batch(11, "med-ors", "ORS sachet", "Rehydration", "ORS-2301", 330, 200, 34, 80, 6, 19),
    batch(12, "med-azi", "Azithromycin 500 mg", "Antibiotic", "AZI-2310", 200, 510, 160, 60, 14, 32),
  ];
}

function seedPrescriptions(p: PatientRow[]): PrescriptionRow[] {
  return [
    { id: "rx-1", code: "RX-1043", patientId: p[1].id, patientName: p[1].name, doctorName: "Dr. Kavita Sharma", issuedAt: minutesAgo(32), status: "ISSUED",
      items: [
        { medicineId: "med-ator", medicineName: "Atorvastatin 20 mg", dosage: "20 mg", frequency: "0-0-1", durationDays: 30, instructions: "After dinner", quantity: 30 },
        { medicineId: "med-asp", medicineName: "Aspirin 75 mg", dosage: "75 mg", frequency: "0-1-0", durationDays: 30, instructions: "After lunch", quantity: 30 },
      ] },
    { id: "rx-2", code: "RX-1042", patientId: p[4].id, patientName: p[4].name, doctorName: "Dr. Farhan Ali", issuedAt: hoursAgo(1), status: "ISSUED",
      items: [
        { medicineId: "med-pcm", medicineName: "Paracetamol 500 mg", dosage: "500 mg", frequency: "1-1-1", durationDays: 5, instructions: "After meals", quantity: 15 },
        { medicineId: "med-pan", medicineName: "Pantoprazole 40 mg", dosage: "40 mg", frequency: "1-0-0", durationDays: 5, instructions: "Before breakfast", quantity: 5 },
      ] },
    { id: "rx-3", code: "RX-1041", patientId: p[5].id, patientName: p[5].name, doctorName: "Dr. Sameer Kapoor", issuedAt: hoursAgo(2), status: "ISSUED",
      items: [{ medicineId: "med-ors", medicineName: "ORS sachet", dosage: "1 sachet", frequency: "As needed", durationDays: 3, instructions: "Dissolve in 1 L water", quantity: 6 }] },
    { id: "rx-4", code: "RX-1038", patientId: p[0].id, patientName: p[0].name, doctorName: "Dr. Kavita Sharma", issuedAt: daysAgo(3), status: "DISPENSED",
      items: [
        { medicineId: "med-aml", medicineName: "Amlodipine 5 mg", dosage: "5 mg", frequency: "1-0-0", durationDays: 30, instructions: "Morning", quantity: 30 },
        { medicineId: "med-cet", medicineName: "Cetirizine 10 mg", dosage: "10 mg", frequency: "0-0-1", durationDays: 5, quantity: 5 },
      ] },
    { id: "rx-5", code: "RX-1029", patientId: p[0].id, patientName: p[0].name, doctorName: "Dr. Sameer Kapoor", issuedAt: daysAgo(48), status: "DISPENSED",
      items: [{ medicineId: "med-pcm", medicineName: "Paracetamol 500 mg", dosage: "500 mg", frequency: "1-1-1", durationDays: 3, quantity: 9 }] },
  ];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function inv(n: number, patient: PatientRow, issuedDaysAgo: number, status: InvoiceRow["status"], items: InvoiceItemRow[], paidFraction = status === "PAID" ? 1 : 0, method?: InvoiceRow["lastPaymentMethod"]): InvoiceRow {
  const totals = invoiceTotals(items);
  return {
    id: `inv-${n}`,
    number: `INV-2024-${String(300 + n).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patient.name,
    issuedAt: daysAgo(issuedDaysAgo),
    dueAt: daysAgo(issuedDaysAgo - 15),
    status,
    items,
    ...totals,
    paid: round2(totals.total * paidFraction),
    lastPaymentMethod: method,
  };
}

const consult = (fee: number): InvoiceItemRow => ({ description: "Consultation", category: "CONSULTATION", quantity: 1, unitPrice: fee, taxRate: 0 });
const lab = (name: string, price: number): InvoiceItemRow => ({ description: name, category: "LAB", quantity: 1, unitPrice: price, taxRate: 0 });
const pharm = (name: string, qty: number, price: number): InvoiceItemRow => ({ description: name, category: "PHARMACY", quantity: qty, unitPrice: price, taxRate: 12 });
const room = (days: number, price: number): InvoiceItemRow => ({ description: "General ward bed", category: "ROOM", quantity: days, unitPrice: price, taxRate: 5 });

function seedInvoices(p: PatientRow[]): InvoiceRow[] {
  return [
    inv(18, p[0], 3, "ISSUED", [consult(900), lab("Complete blood count", 350), pharm("Amlodipine 5 mg", 30, 3.6), pharm("Cetirizine 10 mg", 5, 1.8)]),
    inv(12, p[0], 48, "PAID", [consult(700), pharm("Paracetamol 500 mg", 9, 2)], 1, "UPI"),
    inv(19, p[1], 0, "ISSUED", [consult(900), lab("Lipid profile", 600)]),
    inv(17, p[3], 0, "PARTIALLY_PAID", [consult(1000), lab("Troponin I", 1200), room(1, 1800)], 0.5, "CASH"),
    inv(16, p[4], 0, "PAID", [consult(800), pharm("Paracetamol 500 mg", 15, 2), pharm("Pantoprazole 40 mg", 5, 6.2)], 1, "CARD"),
    inv(15, p[9], 1, "PAID", [consult(800)], 1, "CASH"),
    inv(14, p[7], 2, "PAID", [consult(900), lab("HbA1c", 450)], 1, "UPI"),
    inv(13, p[12], 4, "ISSUED", [consult(900), lab("Serum electrolytes", 500), room(3, 1800)]),
    inv(11, p[13], 6, "PAID", [consult(800), room(2, 1800)], 1, "INSURANCE"),
    inv(10, p[8], 9, "PAID", [consult(900), lab("ECG", 300)], 1, "CASH"),
    inv(9, p[10], 12, "VOID", [consult(600)]),
    inv(8, p[6], 15, "PAID", [consult(600), pharm("Azithromycin 500 mg", 3, 32)], 1, "UPI"),
  ];
}

function seedClaims(): ClaimRow[] {
  return [
    { id: "clm-1", claimNo: "CLM-7781", invoiceNumber: "INV-2024-0311", patientName: "Harpreet Singh", insurer: "Star Health (sample)", amount: 4580, submittedAt: daysAgo(5), status: "UNDER_REVIEW" },
    { id: "clm-2", claimNo: "CLM-7779", invoiceNumber: "INV-2024-0313", patientName: "Meenakshi Sundaram", insurer: "HDFC ERGO (sample)", amount: 7340, submittedAt: daysAgo(3), status: "SUBMITTED" },
    { id: "clm-3", claimNo: "CLM-7770", invoiceNumber: "INV-2024-0305", patientName: "Sunita Reddy", insurer: "ICICI Lombard (sample)", amount: 12600, submittedAt: daysAgo(18), status: "SETTLED" },
    { id: "clm-4", claimNo: "CLM-7766", invoiceNumber: "INV-2024-0302", patientName: "Deepak Verma", insurer: "Star Health (sample)", amount: 3100, submittedAt: daysAgo(25), status: "REJECTED" },
    { id: "clm-5", claimNo: "CLM-7783", invoiceNumber: "INV-2024-0317", patientName: "Suresh Iyer", insurer: "Niva Bupa (sample)", amount: 4000, submittedAt: daysAgo(0), status: "DRAFT" },
  ];
}

function seedStaff(): StaffRow[] {
  const s = (n: number, name: string, role: StaffRow["role"], department?: string, active = true): StaffRow => ({
    id: `stf-${n}`, name, role, department, active,
    email: `${name.toLowerCase().replace(/^dr\.\s*/, "").replace(/\s+/g, ".")}@sunrise.demo`,
    joinedAt: daysAgo(100 + n * 53),
  });
  return [
    s(1, "Dr. Kavita Sharma", "DOCTOR", "Cardiology"),
    s(2, "Dr. Farhan Ali", "DOCTOR", "Orthopedics"),
    s(3, "Dr. Lakshmi Menon", "DOCTOR", "General Medicine"),
    s(4, "Dr. Sameer Kapoor", "DOCTOR", "Pediatrics"),
    s(5, "Dr. Nisha Bhatt", "DOCTOR", "Dermatology", false),
    s(6, "Dr. Imran Shaikh", "DOCTOR", "Emergency"),
    s(7, "Meera Pillai", "NURSE", "Ward B"),
    s(8, "Joseph Thomas", "NURSE", "ICU"),
    s(9, "Arjun Nair", "RECEPTIONIST", "Front desk"),
    s(10, "Sneha Joshi", "LAB_TECHNICIAN", "Laboratory"),
    s(11, "Vikram Desai", "PHARMACIST", "Pharmacy"),
    s(12, "Pooja Iyer", "ACCOUNTANT", "Accounts"),
  ];
}

function seedBeds(p: PatientRow[]): BedRow[] {
  const beds: BedRow[] = [];
  const wards: [string, BedRow["type"], number][] = [
    ["Ward A", "GENERAL", 12],
    ["Ward B", "GENERAL", 12],
    ["ICU", "ICU", 6],
    ["Pediatric", "PEDIATRIC", 6],
    ["Private", "PRIVATE", 6],
  ];
  const occupants = [p[3], p[12], p[7], p[13], p[2], p[8]];
  let o = 0;
  wards.forEach(([ward, type, count], wi) => {
    for (let i = 1; i <= count; i++) {
      const seed = (wi * 7 + i * 3) % 10;
      const status: BedRow["status"] = seed < 6 ? "OCCUPIED" : seed < 8 ? "AVAILABLE" : seed < 9 ? "CLEANING" : "RESERVED";
      const occ = status === "OCCUPIED" && ward === "Ward B" && o < occupants.length ? occupants[o++] : undefined;
      beds.push({
        id: `bed-${ward}-${i}`,
        ward,
        type,
        label: `${ward === "Pediatric" ? "P" : ward === "Private" ? "PR" : ward === "ICU" ? "ICU" : ward.slice(-1)}-${String(i).padStart(2, "0")}`,
        status,
        patientName: status === "OCCUPIED" ? (occ?.name ?? "Occupied") : undefined,
        patientId: occ?.id,
      });
    }
  });
  return beds;
}

function seedHospitals(): HospitalRow[] {
  return [
    { id: "demo-hosp-1", name: "Sunrise General Hospital", city: "Pune", state: "Maharashtra", beds: 120, doctors: 23, patients: 18420, plan: "PROFESSIONAL", status: "ACTIVE", onboardedAt: daysAgo(420), monthlyRevenue: 9_850_000 },
    { id: "h-2", name: "Lakeview Multispeciality", city: "Bhopal", state: "Madhya Pradesh", beds: 80, doctors: 0, patients: 0, plan: "PROFESSIONAL", status: "PENDING_VERIFICATION", onboardedAt: daysAgo(1), monthlyRevenue: 0 },
    { id: "h-3", name: "Greenfield Children's Clinic", city: "Kochi", state: "Kerala", beds: 40, doctors: 9, patients: 6210, plan: "BASIC", status: "ACTIVE", onboardedAt: daysAgo(300), monthlyRevenue: 2_140_000 },
    { id: "h-4", name: "Metro Heart Institute", city: "Hyderabad", state: "Telangana", beds: 200, doctors: 41, patients: 25980, plan: "ENTERPRISE", status: "ACTIVE", onboardedAt: daysAgo(610), monthlyRevenue: 18_300_000 },
    { id: "h-5", name: "Riverside Community Hospital", city: "Nashik", state: "Maharashtra", beds: 60, doctors: 12, patients: 7350, plan: "BASIC", status: "SUSPENDED", onboardedAt: daysAgo(510), monthlyRevenue: 0 },
    { id: "h-6", name: "Hillcrest Ortho & Spine", city: "Dehradun", state: "Uttarakhand", beds: 50, doctors: 8, patients: 3120, plan: "PROFESSIONAL", status: "ACTIVE", onboardedAt: daysAgo(150), monthlyRevenue: 3_420_000 },
    { id: "h-7", name: "Coastal Care Hospital", city: "Mangaluru", state: "Karnataka", beds: 90, doctors: 0, patients: 0, plan: "ENTERPRISE", status: "PENDING_VERIFICATION", onboardedAt: daysAgo(3), monthlyRevenue: 0 },
  ];
}

function seedAudit(): AuditLogRow[] {
  return [
    { id: "a1", at: minutesAgo(2), actor: "Kavita Sharma", actorRole: "DOCTOR", action: "MEDICAL_RECORD_VIEW", entity: "Patient MC-100102", hospital: "Sunrise General Hospital", ip: "10.0.4.21" },
    { id: "a2", at: minutesAgo(6), actor: "Arjun Nair", actorRole: "RECEPTIONIST", action: "APPOINTMENT_CREATE", entity: "Appointment apt-3 (emergency)", hospital: "Sunrise General Hospital", ip: "10.0.4.12" },
    { id: "a3", at: minutesAgo(18), actor: "Sneha Joshi", actorRole: "LAB_TECHNICIAN", action: "LAB_RESULT_APPROVE", entity: "LAB-2031", hospital: "Sunrise General Hospital", ip: "10.0.4.33" },
    { id: "a4", at: minutesAgo(41), actor: "Ravi Menon", actorRole: "HOSPITAL_ADMIN", action: "LOGIN", entity: "Session", hospital: "Metro Heart Institute", ip: "172.16.2.8" },
    { id: "a5", at: hoursAgo(1), actor: "Ananya Rao", actorRole: "SUPER_ADMIN", action: "HOSPITAL_VIEW", entity: "Lakeview Multispeciality", ip: "192.168.1.5" },
    { id: "a6", at: hoursAgo(2), actor: "Pooja Iyer", actorRole: "ACCOUNTANT", action: "PAYMENT_RECORD", entity: "INV-2024-0312 (UPI)", hospital: "Sunrise General Hospital", ip: "10.0.4.40" },
    { id: "a7", at: hoursAgo(3), actor: "unknown", actorRole: "PATIENT", action: "LOGIN_FAILED", entity: "patient@… (3 attempts)", ip: "103.21.58.4" },
    { id: "a8", at: hoursAgo(5), actor: "Vikram Desai", actorRole: "PHARMACIST", action: "STOCK_ADJUST", entity: "Batch MET-2212 (expired, blocked)", hospital: "Sunrise General Hospital", ip: "10.0.4.51" },
    { id: "a9", at: daysAgo(1), actor: "Ananya Rao", actorRole: "SUPER_ADMIN", action: "HOSPITAL_SUSPEND", entity: "Riverside Community Hospital", ip: "192.168.1.5" },
    { id: "a10", at: daysAgo(1), actor: "Rahul Mehta", actorRole: "HOSPITAL_ADMIN", action: "STAFF_CREATE", entity: "Dr. Farhan Ali", hospital: "Sunrise General Hospital", ip: "10.0.4.2" },
  ];
}

function seedVitals(): Record<string, VitalRow[]> {
  const v = (id: string, at: string, by: string, s: number, d: number, pulse: number, t: number, spo2: number, h: number, w: number): VitalRow => ({
    id, recordedAt: at, recordedBy: by, systolic: s, diastolic: d, pulse, temperatureC: t, spo2, heightCm: h, weightKg: w, bmi: calculateBmi(w, h) ?? undefined,
  });
  return {
    "pat-1": [v("v1", daysAgo(3), "Meera Pillai", 134, 86, 82, 36.8, 98, 176, 81), v("v0", daysAgo(48), "Meera Pillai", 126, 82, 88, 38.4, 97, 176, 79)],
    "pat-2": [v("v2", hoursAgo(4), "Meera Pillai", 152, 94, 76, 36.6, 97, 168, 84)],
    "pat-8": [v("v3", minutesAgo(50), "Meera Pillai", 144, 90, 96, 36.9, 96, 172, 90)],
    "pat-4": [v("v4", hoursAgo(1), "Joseph Thomas", 160, 98, 108, 37.1, 93, 170, 77)],
  };
}

function seedDiagnoses(): Record<string, DiagnosisRow[]> {
  return {
    "pat-1": [
      { id: "dx1", code: "I10", description: "Essential (primary) hypertension", type: "FINAL", recordedAt: daysAgo(3), recordedBy: "Dr. Kavita Sharma" },
      { id: "dx0", code: "J06.9", description: "Acute upper respiratory infection", type: "FINAL", recordedAt: daysAgo(48), recordedBy: "Dr. Sameer Kapoor" },
    ],
    "pat-2": [{ id: "dx2", code: "E78.5", description: "Hyperlipidaemia, unspecified", type: "PROVISIONAL", recordedAt: hoursAgo(4), recordedBy: "Dr. Kavita Sharma" }],
  };
}

function seedNotes(): Record<string, EncounterNote[]> {
  return {
    "pat-1": [
      { id: "en1", createdAt: daysAgo(3), author: "Dr. Kavita Sharma", symptoms: "Intermittent chest tightness for 2 weeks, mild headaches. No radiation of pain.", treatmentPlan: "Start amlodipine 5 mg OD. Lipid profile and thyroid panel. Low-salt diet, 30 min walk daily. Review in 1 week." },
      { id: "en0", createdAt: daysAgo(48), author: "Dr. Sameer Kapoor", symptoms: "Fever 38.4 °C, sore throat, body ache for 2 days.", treatmentPlan: "Paracetamol 500 mg TDS for 3 days, fluids, rest." },
    ],
  };
}

function seedMedNotes(): MedicationNote[] {
  return [
    { id: "mn1", patientName: "Suresh Iyer", medicine: "Aspirin-free antiplatelet (as per order)", dose: "1 tab", givenAt: hoursAgo(1), givenBy: "Meera Pillai", note: "Allergy to aspirin verified" },
    { id: "mn2", patientName: "Meenakshi Sundaram", medicine: "Amlodipine 5 mg", dose: "1 tab", givenAt: hoursAgo(3), givenBy: "Meera Pillai" },
    { id: "mn3", patientName: "Deepak Verma", medicine: "Pantoprazole 40 mg", dose: "1 tab", givenAt: hoursAgo(5), givenBy: "Joseph Thomas", note: "Before breakfast" },
  ];
}

function createDb() {
  const patients = seedPatients();
  return {
    patients,
    appointments: seedAppointments(patients),
    labOrders: seedLabOrders(patients),
    batches: seedBatches(),
    prescriptions: seedPrescriptions(patients),
    invoices: seedInvoices(patients),
    claims: seedClaims(),
    staff: seedStaff(),
    beds: seedBeds(patients),
    hospitals: seedHospitals(),
    audit: seedAudit(),
    vitals: seedVitals(),
    diagnoses: seedDiagnoses(),
    notes: seedNotes(),
    medNotes: seedMedNotes(),
    vaccinations: {
      "pat-1": [
        { name: "COVID-19 (Covishield)", dose: "Booster", date: daysAgo(620) },
        { name: "Tetanus toxoid (Td)", dose: "Booster", date: daysAgo(900) },
        { name: "Hepatitis B", dose: "3 of 3", date: daysAgo(4200) },
      ],
      "pat-6": [{ name: "MMR", dose: "Booster", date: daysAgo(0) }],
    } as Record<string, { name: string; dose: string; date: string }[]>,
    familyHistory: {
      "pat-1": ["Father: hypertension, type 2 diabetes", "Mother: hypothyroidism"],
      "pat-2": ["Brother: coronary artery disease (age 55)"],
    } as Record<string, string[]>,
    seq: 5000,
  };
}

export type DemoDb = ReturnType<typeof createDb>;

let db: DemoDb | null = null;

/** The in-memory demo dataset (created on first use, reset on page reload). */
export function demoDb(): DemoDb {
  db ??= createDb();
  return db;
}

export function nextId(prefix: string) {
  const d = demoDb();
  d.seq += 1;
  return `${prefix}-${d.seq}`;
}

/** Return a deep copy so React Query consumers never mutate the demo store directly. */
export function snapshot<T>(value: T): T {
  return structuredClone(value);
}
