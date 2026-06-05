import {
  MessageSquare,
  Mail,
  Users,
  KanbanSquare,
  FileText,
  Workflow,
  BarChart3,
  Plug,
  type LucideIcon,
} from "lucide-react";

export const SUPPORT_EMAIL = "support.crm@tundla.com";

export type FeatureNavItem = {
  slug: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

export const FEATURE_NAV_ITEMS: FeatureNavItem[] = [
  {
    slug: "whatsapp",
    icon: MessageSquare,
    title: "WhatsApp Business",
    description: "Shared team inbox with templates and interactive messages",
  },
  {
    slug: "gmail",
    icon: Mail,
    title: "Gmail Integration",
    description: "Send, receive, and track emails right from the CRM",
  },
  {
    slug: "leads-contacts",
    icon: Users,
    title: "Leads & Contacts",
    description: "Lead status, custom fields, tags, and bulk actions",
  },
  {
    slug: "sales-pipeline",
    icon: KanbanSquare,
    title: "Sales Pipeline",
    description: "Kanban stages, deal tracking, and followup reminders",
  },
  {
    slug: "proposals",
    icon: FileText,
    title: "Proposals & Catalog",
    description: "Create proposals, share catalogs, and close deals faster",
  },
  {
    slug: "automations",
    icon: Workflow,
    title: "Automations & Flows",
    description: "Trigger-based rules and visual WhatsApp chatbots",
  },
  {
    slug: "reports",
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Revenue forecasts, pipeline metrics, and team performance",
  },
  {
    slug: "integrations",
    icon: Plug,
    title: "Integrations",
    description: "Webhooks, broadcasts, embeddable forms, and notifications",
  },
];

export const STATS: { value: string; label: string }[] = [
  { value: "2.4M+", label: "Messages handled" },
  { value: "38%", label: "Faster first response" },
  { value: "12K+", label: "Deals closed monthly" },
  { value: "99.9%", label: "Uptime" },
];

export const TESTIMONIALS: {
  quote: string;
  name: string;
  role: string;
  initials: string;
}[] = [
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
  {
    quote:
      "Our sales team manages everything from Gmail outreach to WhatsApp follow-ups in one place. Pipeline visibility is game-changing.",
    name: "Raj Kapoor",
    role: "VP Sales, Vertex Labs",
    initials: "RK",
  },
  {
    quote:
      "Embeddable forms on our website feed leads straight into the pipeline with auto-assignment. We stopped losing leads overnight.",
    name: "Meera Joshi",
    role: "Marketing Head, Bluepeak",
    initials: "MJ",
  },
  {
    quote:
      "The proposal tracking alone is worth it — we know exactly when a client opens and reviews our quote.",
    name: "Ankit Sharma",
    role: "Sales Manager, Kanso Digital",
    initials: "AS",
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
    q: "Does Tundla integrate with Gmail?",
    a: "Yes. Connect your Gmail account via OAuth and send, receive, and track emails directly within Tundla. Every email is linked to the relevant contact and deal for full context.",
  },
  {
    q: "Can I send proposals and quotations from the CRM?",
    a: "Tundla has a built-in proposal builder with a product catalog, line items, taxes, and discounts. Send proposals via email or WhatsApp and track when clients view, accept, or reject them.",
  },
  {
    q: "What kind of reports does Tundla offer?",
    a: "You get deal conversion funnels, revenue forecasts, deal velocity, source ROI, lost deal analysis, employee performance, and activity reports — all filterable by date range and scoped by role.",
  },
  {
    q: "How many user roles are available?",
    a: "Three roles: Admin (full control), Manager (team-level access to broadcasts, templates, and tags), and Executive (access to their own assigned contacts and deals only). All enforced with row-level security.",
  },
  {
    q: "Can I connect leads from any source, not just Meta?",
    a: "Yes. Create custom webhooks for any platform — website forms, Zapier, Make, or any tool that can send HTTP requests. Tundla maps incoming fields to contacts and deals automatically.",
  },
  {
    q: "How long does it take to get started?",
    a: "Most teams are up and running the same day. Connect your WhatsApp number, import contacts, build a pipeline, and you're live. Our team can walk you through it on a demo.",
  },
  {
    q: "Is my data secure?",
    a: "Security is built in. Access is role-based with row-level security, integration credentials are encrypted at rest with AES-256-GCM, and you have a full audit log of every action. See our Privacy Policy for full details.",
  },
  {
    q: "How do I reach support?",
    a: `Email us anytime at ${SUPPORT_EMAIL} and our team will help you out. You can also book a live demo from the contact page.`,
  },
];
