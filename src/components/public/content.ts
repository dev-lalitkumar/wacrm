import {
  MessageSquare,
  KanbanSquare,
  Megaphone,
  Target,
  Workflow,
  FileText,
  ShoppingBag,
  BarChart3,
  Bell,
  type LucideIcon,
} from "lucide-react";

export const SUPPORT_EMAIL = "support.crm@tundla.com";

export type Feature = {
  icon: LucideIcon;
  title: string;
  blurb: string;
  detail: string;
  points: string[];
};

export const FEATURES: Feature[] = [
  {
    icon: MessageSquare,
    title: "Shared WhatsApp inbox",
    blurb: "Every customer chat in one team inbox — with context, assignments, and replies that feel personal at scale.",
    detail:
      "Bring your WhatsApp Business number into a collaborative inbox. Assign conversations, leave internal notes, use saved replies, and never lose a thread again.",
    points: [
      "Assign chats to teammates and track ownership",
      "Saved replies and message templates",
      "Full contact + deal context beside every chat",
    ],
  },
  {
    icon: KanbanSquare,
    title: "Visual sales pipelines",
    blurb: "Drag deals across stages, forecast revenue, and see exactly where every opportunity stands.",
    detail:
      "Build pipelines that match how you actually sell. Move deals through stages, set values and close dates, and watch your forecast update in real time.",
    points: [
      "Unlimited custom pipelines and stages",
      "Deal value, owner, and close-date tracking",
      "Win/loss reasons for cleaner reporting",
    ],
  },
  {
    icon: Megaphone,
    title: "Broadcasts that convert",
    blurb: "Send targeted WhatsApp campaigns to segmented audiences and measure every open and reply.",
    detail:
      "Reach the right contacts with approved templates, schedule sends, and track delivery, reads, and responses — without spamming your list.",
    points: [
      "Audience segments and scheduling",
      "Template management with approval status",
      "Delivery, read, and reply analytics",
    ],
  },
  {
    icon: Target,
    title: "Meta lead capture",
    blurb: "Facebook & Instagram Lead Ads flow straight into your CRM — no CSV exports, no delays.",
    detail:
      "Connect your Facebook Pages and capture Lead Ads instantly. New leads land in your pipeline the moment they submit, ready for an automated WhatsApp welcome.",
    points: [
      "Instant Facebook Lead Ads sync",
      "WhatsApp Business coexistence support",
      "Auto-create contacts and deals from leads",
    ],
  },
  {
    icon: Workflow,
    title: "Automations & flows",
    blurb: "Welcome new leads, follow up, and route conversations automatically — while you sleep.",
    detail:
      "Design no-code flows that trigger on new leads, replies, or stage changes. Send messages, tag contacts, assign owners, and keep deals moving on their own.",
    points: [
      "Trigger-based automation rules",
      "Multi-step conversational flows",
      "Run logs for every automation",
    ],
  },
  {
    icon: FileText,
    title: "Proposals & catalog",
    blurb: "Build branded proposals and share your product catalog right inside the chat.",
    detail:
      "Create proposals from reusable templates and send them as a tracked link. Showcase products from your catalog so buyers can decide faster.",
    points: [
      "Reusable proposal templates",
      "Shareable, trackable proposal links",
      "Product catalog with rich media",
    ],
  },
];

export const SECONDARY_FEATURES: Feature[] = [
  {
    icon: ShoppingBag,
    title: "Product catalog",
    blurb: "Keep your catalog organized and share items in a tap.",
    detail: "",
    points: [],
  },
  {
    icon: BarChart3,
    title: "Reports & insights",
    blurb: "Dashboards for revenue, conversion, and team performance.",
    detail: "",
    points: [],
  },
  {
    icon: Bell,
    title: "Multi-channel alerts",
    blurb: "In-app, email, and WhatsApp notifications you control.",
    detail: "",
    points: [],
  },
];

export const STATS: { value: string; label: string }[] = [
  { value: "2.4M+", label: "Messages handled" },
  { value: "38%", label: "Faster first response" },
  { value: "12K+", label: "Deals closed monthly" },
  { value: "99.9%", label: "Uptime" },
];

export const TESTIMONIALS: { quote: string; name: string; role: string; initials: string }[] = [
  {
    quote:
      "We replaced three tools with Tundla. Our reps live in the WhatsApp inbox now and our response time dropped by half.",
    name: "Aarav Mehta",
    role: "Head of Sales, Northwind Retail",
    initials: "AM",
  },
  {
    quote:
      "Facebook leads land in our pipeline instantly and get a WhatsApp reply within seconds. Conversion is up across the board.",
    name: "Sofia Rossi",
    role: "Growth Lead, Lumio Studio",
    initials: "SR",
  },
  {
    quote:
      "The automations alone pay for themselves. Follow-ups never slip through the cracks anymore.",
    name: "Priya Nair",
    role: "Founder, Saffron & Co.",
    initials: "PN",
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Does Tundla work with the official WhatsApp Business API?",
    a: "Yes. Tundla connects to WhatsApp Business and supports coexistence, so your team can manage conversations from a shared inbox while staying fully compliant with Meta's policies.",
  },
  {
    q: "Can I capture leads from Facebook and Instagram ads?",
    a: "Absolutely. Connect your Facebook Pages and Lead Ads forms, and new leads sync into your CRM the moment they're submitted — ready for an automated WhatsApp welcome.",
  },
  {
    q: "How long does it take to get started?",
    a: "Most teams are up and running the same day. Connect your WhatsApp number, import contacts, build a pipeline, and you're live. Our team can walk you through it on a demo.",
  },
  {
    q: "Is my data secure?",
    a: "Security is built in. Access is role-based, integration credentials are encrypted at rest, and you stay in control of your data. See our Privacy Policy for full details.",
  },
  {
    q: "How do I reach support?",
    a: `Email us anytime at ${SUPPORT_EMAIL} and our team will help you out. You can also book a live demo from the contact page.`,
  },
];
