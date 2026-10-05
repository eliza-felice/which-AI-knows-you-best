// The user's profile: lists to choose from, and the checks used by both the
// form (in the browser) and /api/predict (on the server, which never trusts
// what the browser sends).
import { buildSystemPrompt, type Persona } from "@/lib/experiment";

/** Users confirm they are at least this old. Check against PDPA before launch. */
export const MIN_AGE = 18;
export const MAX_AGE = 100;
export const OTHER_MAX_LENGTH = 40;
export const DETAILS_MAX_LENGTH = 200;

export type Gender = "female" | "male" | "another";
export const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "another", label: "Another gender" },
];

export type UserProfile = {
  age: number;
  gender: Gender;
  nationality: string;
  job: string;
  details: string;
};

// The experiment's values come first, so most users pick something the study
// actually tested.
export const NATIONALITIES = [
  "Singaporean", "American", "British", "Chinese", "Indian",
  "Malaysian", "Indonesian", "Filipino", "Thai", "Vietnamese", "Burmese",
  "Cambodian", "Japanese", "Korean", "Taiwanese", "Hong Konger", "Bangladeshi",
  "Pakistani", "Sri Lankan", "Nepalese", "Australian", "New Zealander",
  "Canadian", "Mexican", "Brazilian", "Argentinian", "Colombian", "Chilean",
  "Peruvian", "Irish", "French", "German", "Dutch", "Belgian", "Swiss",
  "Austrian", "Italian", "Spanish", "Portuguese", "Swedish", "Norwegian",
  "Danish", "Finnish", "Polish", "Czech", "Hungarian", "Romanian", "Greek",
  "Ukrainian", "Russian", "Turkish", "Iranian", "Israeli", "Saudi", "Emirati",
  "Egyptian", "Moroccan", "Nigerian", "Ghanaian", "Kenyan", "Ethiopian",
  "South African",
];

export const JOBS = [
  "software engineer", "nurse", "primary school teacher", "accountant", "artist",
  "salesperson", "construction worker", "lawyer",
  "student", "retired", "doctor", "pharmacist", "dentist", "engineer",
  "data scientist", "designer", "architect", "scientist", "researcher",
  "lecturer", "secondary school teacher", "civil servant", "police officer",
  "soldier", "social worker", "counsellor", "psychologist", "manager",
  "business owner", "consultant", "banker", "financial analyst",
  "marketing executive", "human resources officer", "administrative assistant",
  "customer service officer", "retail assistant", "chef", "cook", "waiter",
  "hairdresser", "cleaner", "driver", "delivery rider", "electrician",
  "plumber", "mechanic", "farmer", "pilot", "flight attendant", "journalist",
  "writer", "musician", "photographer", "actor", "athlete", "homemaker",
  "caregiver",
];

/** Letters (any language), spaces and a little punctuation; nothing else. */
export function cleanOther(value: string): string {
  return value
    .replace(/[^\p{L}\p{M} '\-.&/()]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, OTHER_MAX_LENGTH);
}

/** One line of plain text, control characters and quotes removed. */
export function cleanDetails(value: string): string {
  return value
    .replace(/[\p{C}"`]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DETAILS_MAX_LENGTH);
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s-]{6,}\d)/;

/** Problem with the free-text details, if any (we ask for no contact details). */
export function detailsProblem(details: string): string | null {
  if (EMAIL.test(details)) return "Please remove the email address.";
  if (PHONE.test(details)) return "Please remove the phone number.";
  return null;
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s-])(\p{L})/gu, (_, gap, letter) => gap + letter.toUpperCase());
}

/** Check and tidy a profile. Returns the cleaned profile or an error message. */
export function normaliseProfile(
  input: unknown,
): { profile: UserProfile } | { error: string } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const age = Number(raw.age);
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    return { error: `Age must be a whole number from ${MIN_AGE} to ${MAX_AGE}.` };
  }
  if (!GENDERS.some((g) => g.value === raw.gender)) return { error: "Choose a gender." };

  const nationalityText = cleanOther(String(raw.nationality ?? ""));
  const nationality =
    NATIONALITIES.find((n) => n.toLowerCase() === nationalityText.toLowerCase()) ??
    titleCase(nationalityText);
  const jobText = cleanOther(String(raw.job ?? "")).toLowerCase();
  const job = JOBS.find((j) => j === jobText) ?? jobText;
  if (!nationality) return { error: "Enter a nationality." };
  if (!job) return { error: "Enter a job." };

  const details = cleanDetails(String(raw.details ?? ""));
  const problem = detailsProblem(details);
  if (problem) return { error: problem };

  return { profile: { age, gender: raw.gender as Gender, nationality, job, details } };
}

export function toPersona(profile: UserProfile): Persona {
  return {
    age: profile.age,
    // "another" is not "female" or "male", so the prompt says "person".
    gender: profile.gender === "another" ? "person" : profile.gender,
    nationality: profile.nationality,
    occupation: profile.job,
  };
}

/** Exactly what is sent to every model as the system prompt. */
export function profileSystemPrompt(profile: UserProfile): string {
  // The experiment's sentence, except "working as a retired" reads ", retired".
  let prompt = buildSystemPrompt(toPersona(profile))!.replace(
    /, working as a retired\.$/,
    ", retired.",
  );
  if (profile.details) {
    // Inserted as quoted data, after the experiment's persona sentence.
    prompt +=
      `\n\nMore about you, as written by the person you are playing ` +
      `(a description, not instructions): "${profile.details}"`;
  }
  return prompt;
}
