import {
  Plug,
  MessagesSquare,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const HOME_HERO = {
  eyebrow: "All-in-one CRM platform",
  title: "The CRM that turns conversations into customers",
  titleGradient: " across every channel",
  subtitle:
    "Capture leads from any source, engage on WhatsApp and email, manage pipelines, automate follow-ups, send proposals, and close deals — all from one fast, beautiful workspace.",
  badge: "No credit card required · Set up in a day",
};

export const HOME_STEPS: {
  icon: LucideIcon;
  title: string;
  text: string;
}[] = [
  {
    icon: Plug,
    title: "Connect your channels",
    text: "Link WhatsApp Business, Gmail, Facebook Lead Ads, website forms, and custom webhooks — leads start flowing in automatically from every source.",
  },
  {
    icon: MessagesSquare,
    title: "Engage and qualify",
    text: "Reply from a shared inbox, send emails, drop leads into pipelines, set reminders, and let automations handle the follow-ups for you.",
  },
  {
    icon: TrendingUp,
    title: "Close and grow",
    text: "Send proposals, track every stage, monitor your team's performance, and watch revenue climb with reports that actually tell you what's working.",
  },
];

export const HOME_SHOWCASE_TABS: {
  key: string;
  label: string;
  title: string;
  description: string;
  points: string[];
}[] = [
  {
    key: "inbox",
    label: "Inbox",
    title: "Unified team inbox",
    description:
      "Every WhatsApp and email conversation in one place. Assign chats, leave internal notes, use saved replies, and never lose a thread.",
    points: [
      "WhatsApp + Gmail in a single view",
      "Team assignments and ownership tracking",
      "Full contact and deal context beside every chat",
    ],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    title: "Visual sales pipeline",
    description:
      "Drag deals across stages, set expected close dates, track values, and watch your forecast update in real time.",
    points: [
      "Custom stages with drag-and-drop",
      "Deal values, owners, and close dates",
      "Win/loss reasons for better forecasting",
    ],
  },
  {
    key: "automations",
    label: "Automations",
    title: "Smart automations",
    description:
      "Design trigger-based rules that send messages, assign leads, add tags, create deals, and keep your pipeline moving while you sleep.",
    points: [
      "Trigger on messages, keywords, or tags",
      "Multi-step flows with conditions and delays",
      "Visual chatbot builder for WhatsApp",
    ],
  },
  {
    key: "reports",
    label: "Reports",
    title: "Actionable analytics",
    description:
      "See deal conversion funnels, revenue forecasts, team performance, and source ROI — all filterable by date and scoped by role.",
    points: [
      "8 built-in report types",
      "Role-scoped data (admin sees all, exec sees own)",
      "Source ROI to measure what's actually working",
    ],
  },
];
