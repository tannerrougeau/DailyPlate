import type { UserProfile } from "@/types/profile";

export type ProteinPerKgPreset = 1.6 | 1.8 | 2.0;

export const PROTEIN_PER_KG_PRESETS: { id: ProteinPerKgPreset; label: string }[] = [
  { id: 1.6, label: "1.6 g/kg (moderate)" },
  { id: 1.8, label: "1.8 g/kg (balanced)" },
  { id: 2.0, label: "2.0 g/kg (higher)" },
];

export function proteinGramsFromPreset(weightKg: number, preset: ProteinPerKgPreset): number {
  return Math.round(weightKg * preset);
}

export function suggestedProteinRange(weightKg: number): { low: number; high: number } {
  return {
    low: proteinGramsFromPreset(weightKg, 1.6),
    high: proteinGramsFromPreset(weightKg, 2.0),
  };
}

export function effectiveMinimumProteinGrams(profile: UserProfile): number | null {
  if (!profile.prioritizeMinProtein) return null;
  if (profile.minimumProteinGrams != null && profile.minimumProteinGrams > 0) {
    return Math.round(profile.minimumProteinGrams);
  }
  return proteinGramsFromPreset(profile.weightKg, 1.8);
}
