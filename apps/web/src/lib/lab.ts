"use client";

import { useHmsQuery } from "@/lib/use-hms-query";

export interface LabTestDef {
  name: string;
  price: number;
  parameters: { parameter: string; unit: string; refLow: number; refHigh: number }[];
}

/**
 * Lab test catalog with configured reference ranges (adult values; SAMPLE configuration).
 * In live mode this comes from the LabTest table via GET /lab/tests.
 */
const DEMO_CATALOG: LabTestDef[] = [
  { name: "Complete blood count", price: 350, parameters: [
    { parameter: "Hemoglobin", unit: "g/dL", refLow: 12, refHigh: 17.5 },
    { parameter: "WBC", unit: "×10³/µL", refLow: 4, refHigh: 11 },
    { parameter: "Platelets", unit: "×10³/µL", refLow: 150, refHigh: 450 },
  ] },
  { name: "Lipid profile", price: 600, parameters: [
    { parameter: "Total cholesterol", unit: "mg/dL", refLow: 125, refHigh: 200 },
    { parameter: "LDL", unit: "mg/dL", refLow: 0, refHigh: 130 },
    { parameter: "HDL", unit: "mg/dL", refLow: 40, refHigh: 60 },
    { parameter: "Triglycerides", unit: "mg/dL", refLow: 0, refHigh: 150 },
  ] },
  { name: "Thyroid profile (T3, T4, TSH)", price: 550, parameters: [
    { parameter: "T3", unit: "ng/dL", refLow: 80, refHigh: 200 },
    { parameter: "T4", unit: "µg/dL", refLow: 5, refHigh: 12 },
    { parameter: "TSH", unit: "µIU/mL", refLow: 0.4, refHigh: 4 },
  ] },
  { name: "HbA1c", price: 450, parameters: [{ parameter: "HbA1c", unit: "%", refLow: 4, refHigh: 5.6 }] },
  { name: "Serum electrolytes", price: 500, parameters: [
    { parameter: "Sodium", unit: "mmol/L", refLow: 135, refHigh: 145 },
    { parameter: "Potassium", unit: "mmol/L", refLow: 3.5, refHigh: 5.1 },
    { parameter: "Chloride", unit: "mmol/L", refLow: 98, refHigh: 107 },
  ] },
  { name: "Troponin I", price: 1200, parameters: [{ parameter: "Troponin I", unit: "ng/mL", refLow: 0, refHigh: 0.04 }] },
  { name: "Urine routine", price: 200, parameters: [
    { parameter: "pH", unit: "", refLow: 4.5, refHigh: 8 },
    { parameter: "Specific gravity", unit: "", refLow: 1.005, refHigh: 1.03 },
  ] },
  { name: "Fasting blood sugar", price: 120, parameters: [{ parameter: "Glucose (fasting)", unit: "mg/dL", refLow: 70, refHigh: 100 }] },
];

export const useLabCatalog = () => useHmsQuery<LabTestDef[]>({ key: ["labCatalog"], path: "/lab/tests", demo: () => DEMO_CATALOG });
