import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { GroceryScreen } from "@/screens/GroceryScreen";
import { PlanScreen } from "@/screens/PlanScreen";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";
import { GuideScreen } from "@/screens/GuideScreen";
import { RecipesScreen } from "@/screens/RecipesScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { TodayScreen } from "@/screens/TodayScreen";
import { useAppStore } from "@/store/useAppStore";

export default function App() {
  const nav = useAppStore((s) => s.nav);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [nav]);

  if (showLogin && onboardingComplete !== true) {
    return (
      <div className="min-h-dvh bg-cream">
        <LoginScreen
          onBack={() => setShowLogin(false)}
          onCreateAccount={() => setShowLogin(false)}
        />
      </div>
    );
  }

  if (onboardingComplete !== true) {
    return (
      <div className="min-h-dvh bg-cream">
        <OnboardingFlow onLogin={() => setShowLogin(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cream">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <main id="main">
        {nav === "today" && <TodayScreen />}
        {nav === "plan" && <PlanScreen />}
        {nav === "recipes" && <RecipesScreen />}
        {nav === "grocery" && <GroceryScreen />}
        {nav === "guide" && <GuideScreen />}
      </main>
      <BottomNav />
    </div>
  );
}
