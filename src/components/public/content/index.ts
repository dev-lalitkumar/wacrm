export {
  SUPPORT_EMAIL,
  FEATURE_NAV_ITEMS,
  STATS,
  TESTIMONIALS,
  FAQS,
  type FeatureNavItem,
} from "./shared";

export { HOME_HERO, HOME_STEPS, HOME_SHOWCASE_TABS } from "./home";

export {
  FEATURE_PAGES,
  type FeaturePageData,
  type FeatureSection,
} from "./feature-pages";

// Re-export legacy types and arrays so existing imports from
// "@/components/public/content" keep working.
import { FEATURE_NAV_ITEMS } from "./shared";
import type { LucideIcon } from "lucide-react";

export type Feature = {
  icon: LucideIcon;
  title: string;
  blurb: string;
  detail: string;
  points: string[];
};

export const FEATURES: Feature[] = FEATURE_NAV_ITEMS.map((item) => ({
  icon: item.icon,
  title: item.title,
  blurb: item.description,
  detail: "",
  points: [],
}));

export const SECONDARY_FEATURES: Feature[] = [];
