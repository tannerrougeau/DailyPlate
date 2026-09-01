import type { MainGoal, UserProfile } from "@/types/profile";
import type { CalorieRecommendation, CheckInEntry } from "@/types/tdeeFeedback";
import { MIN_FEEDBACK_FOR_ADAPTIVE, MIN_WEEKS_FOR_ADAPTIVE } from "@/types/tdeeFeedback";
import { weightToKg, type WeightUnit } from "@/utils/bodyMeasurements";
import { computeDailyTargets, computeFormulaTdee } from "@/utils/tdee";

const KCAL_PER_KG = 7700;
const MS_PER_DAY = 86_400_000;

export function daysBetweenDates(a: Date, b: Date): number {
  return Math.max(1, Math.round(Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY));
}

export function weeksSinceAnchor(anchorIso: string | null, now = new Date()): number {
  if (!anchorIso) return 0;
  return daysBetweenDates(new Date(anchorIso), now) / 7;
}

export function isAdaptiveModelEligible(
  history: CheckInEntry[],
  profileAnchoredAt: string | null,
): boolean {
  if (history.length < MIN_FEEDBACK_FOR_ADAPTIVE) return false;
  const anchor = profileAnchoredAt ?? history[0]!.submittedAt;
  return weeksSinceAnchor(anchor) >= MIN_WEEKS_FOR_ADAPTIVE;
}

export function weightChangeKg(
  direction: CheckInEntry["weightChangeDirection"],
  amount: number | null,
  unit: WeightUnit,
): number {
  if (direction === "same") return 0;
  const raw = amount ?? 0;
  const kg = unit === "lbs" ? weightToKg(raw, "lbs") : raw;
  return direction === "lost" ? -kg : kg;
}

function goalCalorieDelta(goal: MainGoal): number {
  switch (goal) {
    case "lose":
      return -450;
    case "maintain":
      return 0;
    case "gain":
      return 320;
    case "health":
      return -200;
    default:
      return 0;
  }
}

function estimateIntervalTdee(
  periodDays: number,
  calorieTarget: number,
  adherence10: number,
  weightDeltaKg: number,
): number {
  const avgIntake = calorieTarget * (adherence10 / 10);
  const dailyEnergyBalance = (-weightDeltaKg * KCAL_PER_KG) / periodDays;
  return avgIntake + dailyEnergyBalance;
}

export function estimateDataDrivenTdee(history: CheckInEntry[]): number | null {
  if (history.length < MIN_FEEDBACK_FOR_ADAPTIVE) return null;

  const estimates: { tdee: number; weight: number }[] = [];
  for (let i = 1; i < history.length; i++) {
    const curr = history[i]!;
    const days = Math.max(1, curr.periodDays);
    const deltaKg = weightChangeKg(
      curr.weightChangeDirection,
      curr.weightChangeAmount,
      curr.weightChangeUnit,
    );
    const tdee = estimateIntervalTdee(
      days,
      curr.calorieTargetAtSubmit,
      curr.calorieAdherence,
      deltaKg,
    );
    if (Number.isFinite(tdee) && tdee >= 1200 && tdee <= 6000) {
      estimates.push({ tdee, weight: days });
    }
  }

  if (estimates.length === 0) return null;
  const totalWeight = estimates.reduce((s, e) => s + e.weight, 0);
  const blended = estimates.reduce((s, e) => s + e.tdee * e.weight, 0) / totalWeight;
  return Math.round(blended);
}

function questionnaireCalorieNudge(
  entry: CheckInEntry,
  goal: MainGoal,
): { delta: number; reasons: string[] } {
  const reasons: string[] = [];
  let delta = 0;

  const weightKg = weightChangeKg(
    entry.weightChangeDirection,
    entry.weightChangeAmount,
    entry.weightChangeUnit,
  );

  if (entry.energyLevel <= 4) {
    if (weightKg < -0.2) {
      delta += 100;
      reasons.push("Low energy with weight loss — a modest calorie bump may help recovery.");
    } else {
      delta += 50;
      reasons.push("Low reported energy — slightly higher calories could support day-to-day feel.");
    }
  }

  if (entry.calorieAdherence >= 8 && entry.weightChangeDirection === "same" && goal === "lose") {
    delta -= 75;
    reasons.push("Strong adherence with little weight change — a small reduction may restart progress.");
  }

  if (entry.calorieAdherence <= 4) {
    reasons.push("Adherence was lower this period — focus on consistency before large target changes.");
  }

  if (entry.activityChange === "more") {
    delta += 100;
    reasons.push("Activity increased — your body likely needs more fuel.");
  } else if (entry.activityChange === "less") {
    delta -= 75;
    reasons.push("Activity decreased — a slightly lower target may match current burn.");
  }

  if (entry.sleepQuality <= 4) {
    reasons.push("Sleep was low — recovery can affect scale weight and hunger; be gentle with big cuts.");
  }

  if (entry.proteinAdherence <= 5) {
    reasons.push("Protein adherence was moderate — hitting protein supports muscle and satiety.");
  } else if (entry.proteinAdherence >= 8) {
    reasons.push("Strong protein adherence — great for preserving lean mass.");
  }

  if (entry.strengthProgress >= 8) {
    reasons.push("Training progress looked solid — keep protein up as you adjust calories.");
  } else if (entry.strengthProgress <= 4) {
    reasons.push("Training felt tougher — energy and sleep may be limiting factors.");
  }

  return { delta, reasons };
}

export function buildCalorieRecommendation(
  profile: UserProfile,
  history: CheckInEntry[],
  currentCalories: number,
  profileAnchoredAt: string | null,
): CalorieRecommendation {
  const latest = history[history.length - 1]!;
  const goal = profile.goal;
  const usedAdaptive = isAdaptiveModelEligible(history, profileAnchoredAt);
  const estimatedTdee = usedAdaptive ? estimateDataDrivenTdee(history) : null;
  const formulaTdee = computeFormulaTdee(profile);

  const reasoning: string[] = [];
  let suggested = currentCalories;

  if (usedAdaptive && estimatedTdee != null) {
    suggested = Math.round(
      Math.max(1200, estimatedTdee + goalCalorieDelta(goal)),
    );
    reasoning.push(
      `From your last ${history.length} check-ins over ${Math.round(weeksSinceAnchor(profileAnchoredAt ?? history[0]!.submittedAt))} weeks, we estimate maintenance near ${estimatedTdee.toLocaleString()} kcal.`,
    );
    reasoning.push(
      `Formula baseline is ~${formulaTdee.toLocaleString()} kcal; your trend suggests ${estimatedTdee.toLocaleString()} kcal.`,
    );
  } else if (history.length === 1) {
    reasoning.push(
      "After one more check-in (and about 4 weeks total), we can personalize TDEE from your trends.",
    );
    reasoning.push(
      `For now we're using your formula-based target (~${formulaTdee.toLocaleString()} kcal maintenance).`,
    );
  } else {
    const needFeedback = Math.max(0, MIN_FEEDBACK_FOR_ADAPTIVE - history.length);
    const needWeeks = Math.max(
      0,
      Math.ceil(
        MIN_WEEKS_FOR_ADAPTIVE -
          weeksSinceAnchor(profileAnchoredAt ?? history[0]!.submittedAt),
      ),
    );
    const parts: string[] = [];
    if (needFeedback > 0) parts.push(`${needFeedback} more check-in(s)`);
    if (needWeeks > 0) parts.push(`about ${needWeeks} more week(s)`);
    reasoning.push(
      parts.length > 0
        ? `Building your personal model — ${parts.join(" and ")}.`
        : "Almost ready to personalize TDEE from your trends.",
    );
  }

  const { delta: nudge, reasons: nudgeReasons } = questionnaireCalorieNudge(latest, goal);
  reasoning.push(...nudgeReasons);

  if (!usedAdaptive || estimatedTdee == null) {
    suggested = currentCalories + nudge;
  } else {
    suggested += Math.round(nudge * 0.35);
  }

  const maxStep = usedAdaptive ? 300 : 200;
  let delta = suggested - currentCalories;
  delta = Math.max(-maxStep, Math.min(maxStep, delta));
  suggested = currentCalories + delta;

  if (delta === 0) {
    reasoning.push("Your current calorie target still looks like a good fit.");
  }

  return {
    suggestedCalories: Math.round(suggested),
    deltaCalories: Math.round(suggested - currentCalories),
    reasoning,
    usedAdaptiveModel: usedAdaptive && estimatedTdee != null,
    estimatedTdee,
  };
}

export function targetsWithCalories(
  profile: UserProfile,
  calories: number,
): ReturnType<typeof computeDailyTargets> {
  const base = computeDailyTargets(profile);
  if (base.calories === calories) return base;
  const proteinKcal = base.protein * 4;
  const fatKcal = base.fat * 9;
  const carbKcal = Math.max(0, calories - proteinKcal - fatKcal);
  return {
    calories,
    protein: base.protein,
    carbs: Math.round(carbKcal / 4),
    fat: base.fat,
    fiber: Math.round((calories / 1000) * 14),
  };
}
