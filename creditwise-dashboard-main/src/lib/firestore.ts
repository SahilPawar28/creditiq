import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Types ──────────────────────────────────────────────────────────────────
export interface ApplicationData {
  userId: string;
  userEmail: string;
  fullName: string;
  // Input fields
  income: number;
  loanAmount: number;
  employmentLength: number;
  existingDebt: number;
  creditHistory: string;
  numExistingLoans: number;
  // ML output
  creditScore: number;
  riskLevel: string;
  defaultProbability: number;
  decision: string;
  reasons: string[];
  dti: number;
  loanToIncome: number;
  creditUtilization: number;
  // Meta
  createdAt: Timestamp;
}

export interface ApplicationDoc extends ApplicationData {
  id: string;
}

// ── Write ──────────────────────────────────────────────────────────────────
export async function saveApplication(
  data: Omit<ApplicationData, "createdAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "applications"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

// ── Read ───────────────────────────────────────────────────────────────────
export async function getApplicationById(id: string): Promise<ApplicationDoc> {
  const snap = await getDoc(doc(db, "applications", id));
  if (!snap.exists()) throw new Error("Application not found");
  return { id: snap.id, ...(snap.data() as ApplicationData) };
}

export async function getUserApplications(userId: string): Promise<ApplicationDoc[]> {
  const q = query(
    collection(db, "applications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ApplicationData) }));
}

export async function getAllApplications(cap = 500): Promise<ApplicationDoc[]> {
  const q = query(
    collection(db, "applications"),
    orderBy("createdAt", "desc"),
    limit(cap),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ApplicationData) }));
}

export async function getRecentApplications(
  userId: string,
  count = 5,
): Promise<ApplicationDoc[]> {
  const q = query(
    collection(db, "applications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ApplicationData) }));
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function formatINR(amount: number): string {
  if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount}`;
}

export function tsToDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
