/**
 * Check-in questionnaire definition — extend sections/questions here without
 * restructuring the form UI.
 */

export type CheckInScaleQuestion = {
  kind: "scale";
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  section: "body" | "adherence" | "experience" | "activity";
};

export type CheckInChoiceQuestion = {
  kind: "choice";
  id: string;
  label: string;
  section: "body";
  options: { id: string; label: string }[];
};

export type CheckInTextQuestion = {
  kind: "text";
  id: string;
  label: string;
  placeholder: string;
  section: "experience" | "activity";
  optional?: boolean;
};

export type CheckInQuestion = CheckInScaleQuestion | CheckInChoiceQuestion | CheckInTextQuestion;

export const CHECK_IN_INTRO =
  "Optional and user-triggered. Share how things are going so we can refine your calorie target and improve your meal planning experience.";

export const CHECK_IN_DISCLAIMER =
  "Scientific formulas give a good starting point, but individual results vary. Your check-in responses are saved to your profile and help personalize targets over time.";

export const CHECK_IN_SCALE_QUESTIONS: CheckInScaleQuestion[] = [
  {
    kind: "scale",
    id: "energyLevel",
    label: "Energy levels",
    hint: "1 = exhausted · 10 = great",
    min: 1,
    max: 10,
    section: "adherence",
  },
  {
    kind: "scale",
    id: "calorieAdherence",
    label: "Calorie target adherence",
    hint: "1 = rarely on target · 10 = very consistent",
    min: 1,
    max: 10,
    section: "adherence",
  },
  {
    kind: "scale",
    id: "proteinAdherence",
    label: "Protein adherence",
    hint: "1 = struggled · 10 = nailed it",
    min: 1,
    max: 10,
    section: "adherence",
  },
  {
    kind: "scale",
    id: "sleepQuality",
    label: "Sleep quality recently",
    hint: "0 = very poor · 10 = excellent",
    min: 0,
    max: 10,
    section: "adherence",
  },
  {
    kind: "scale",
    id: "strengthProgress",
    label: "Strength / conditioning progress",
    hint: "1 = regressing · 10 = strong progress",
    min: 1,
    max: 10,
    section: "adherence",
  },
  {
    kind: "scale",
    id: "mealVarietySatisfaction",
    label: "Meal variety",
    hint: "1 = too repetitive · 10 = great variety",
    min: 1,
    max: 10,
    section: "experience",
  },
  {
    kind: "scale",
    id: "planEaseOfUse",
    label: "Ease of following your plan",
    hint: "1 = difficult · 10 = very easy",
    min: 1,
    max: 10,
    section: "experience",
  },
  {
    kind: "scale",
    id: "recipeEnjoyment",
    label: "Enjoyment of suggested meals",
    hint: "1 = rarely enjoyed · 10 = loved them",
    min: 1,
    max: 10,
    section: "experience",
  },
  {
    kind: "scale",
    id: "hungerManagement",
    label: "Hunger & fullness balance",
    hint: "1 = too hungry · 10 = well satisfied",
    min: 1,
    max: 10,
    section: "experience",
  },
];

export const EXPERIENCE_SCALE_IDS = CHECK_IN_SCALE_QUESTIONS.filter(
  (q) => q.section === "experience",
).map((q) => q.id);

export const ADHERENCE_SCALE_IDS = CHECK_IN_SCALE_QUESTIONS.filter(
  (q) => q.section === "adherence",
).map((q) => q.id);
