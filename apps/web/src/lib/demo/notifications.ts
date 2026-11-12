import type { NotificationItem, Role } from "@medcore/types";
import { hoursAgo, minutesAgo, daysAgo } from "@/lib/demo/time";

/** SAMPLE DATA — fictional notifications for demo mode. */
export function demoNotifications(role: Role): NotificationItem[] {
  const byRole: Partial<Record<Role, NotificationItem[]>> = {
    DOCTOR: [
      { id: "n1", type: "EMERGENCY_APPOINTMENT", title: "Emergency appointment", body: "Suresh Iyer (chest pain) added to your queue at 10:00.", createdAt: minutesAgo(6), read: false },
      { id: "n2", type: "LAB_REPORT_APPROVED", title: "Lab report approved", body: "Lipid profile for Anil Kulkarni is ready to review.", createdAt: minutesAgo(48), read: false },
      { id: "n3", type: "APPOINTMENT_CONFIRMED", title: "Appointment confirmed", body: "Priya Das booked a follow-up for tomorrow, 11:30.", createdAt: hoursAgo(3), read: true },
    ],
    PHARMACIST: [
      { id: "n1", type: "LOW_STOCK", title: "Low stock", body: "Amoxicillin 500 mg is below its reorder level (42 left).", createdAt: minutesAgo(15), read: false },
      { id: "n2", type: "PRESCRIPTION_READY", title: "New prescription", body: "Dr. Kavita Sharma issued RX-1043 for Anil Kulkarni.", createdAt: minutesAgo(32), read: false },
      { id: "n3", type: "LOW_STOCK", title: "Batch expiring", body: "Batch PCM-2207 of Paracetamol expires in 21 days.", createdAt: hoursAgo(5), read: true },
    ],
    PATIENT: [
      { id: "n1", type: "LAB_REPORT_APPROVED", title: "Your lab report is ready", body: "Complete Blood Count report has been approved.", createdAt: hoursAgo(2), read: false },
      { id: "n2", type: "APPOINTMENT_REMINDER", title: "Appointment reminder", body: "Dr. Kavita Sharma, tomorrow at 11:30 (Cardiology).", createdAt: hoursAgo(20), read: false },
      { id: "n3", type: "INVOICE_ISSUED", title: "Invoice issued", body: "INV-2024-0318 for ₹1,850 is due.", createdAt: daysAgo(2), read: true },
    ],
    LAB_TECHNICIAN: [
      { id: "n1", type: "SYSTEM", title: "New test order", body: "Thyroid profile ordered for Rohan Kulkarni (urgent).", createdAt: minutesAgo(9), read: false },
      { id: "n2", type: "SYSTEM", title: "Result pending approval", body: "CBC for Priya Das is waiting for approval.", createdAt: hoursAgo(1), read: true },
    ],
    ACCOUNTANT: [
      { id: "n1", type: "PAYMENT_RECEIVED", title: "Payment received", body: "₹4,200 (UPI) received for INV-2024-0312.", createdAt: minutesAgo(22), read: false },
      { id: "n2", type: "INVOICE_ISSUED", title: "Invoice issued", body: "Reception issued INV-2024-0318.", createdAt: hoursAgo(2), read: true },
    ],
    RECEPTIONIST: [
      { id: "n1", type: "EMERGENCY_APPOINTMENT", title: "Emergency arrival", body: "Suresh Iyer flagged as emergency for Cardiology.", createdAt: minutesAgo(6), read: false },
      { id: "n2", type: "APPOINTMENT_CONFIRMED", title: "Online booking", body: "Neha Gupta booked Orthopedics at 14:30.", createdAt: minutesAgo(40), read: false },
    ],
    HOSPITAL_ADMIN: [
      { id: "n1", type: "LOW_STOCK", title: "3 medicines below reorder level", body: "Pharmacy stock needs attention.", createdAt: minutesAgo(15), read: false },
      { id: "n2", type: "SYSTEM", title: "New staff account", body: "Dr. Farhan Ali was added to Orthopedics.", createdAt: daysAgo(1), read: true },
    ],
    SUPER_ADMIN: [
      { id: "n1", type: "SYSTEM", title: "Hospital awaiting verification", body: "Lakeview Multispeciality submitted onboarding documents.", createdAt: hoursAgo(1), read: false },
      { id: "n2", type: "PAYMENT_RECEIVED", title: "Subscription renewed", body: "Sunrise General renewed the Professional plan.", createdAt: daysAgo(1), read: true },
    ],
    NURSE: [
      { id: "n1", type: "SYSTEM", title: "Vitals due", body: "4 patients in Ward B are due for 2-hourly vitals.", createdAt: minutesAgo(10), read: false },
      { id: "n2", type: "SYSTEM", title: "Medication round", body: "Evening medication round starts at 18:00.", createdAt: hoursAgo(2), read: true },
    ],
  };
  return byRole[role] ?? [];
}
