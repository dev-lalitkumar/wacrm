import {
  MessageSquare,
  Mail,
  Users,
  KanbanSquare,
  FileText,
  Workflow,
  BarChart3,
  Plug,
  Inbox,
  MessagesSquare,
  Send,
  LayoutTemplate,
  Target,
  UserPlus,
  Tags,
  Search,
  Phone,
  SlidersHorizontal,
  GripVertical,
  Clock,
  Bell,
  CircleDollarSign,
  CalendarCheck,
  FileBarChart,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  Zap,
  GitBranch,
  MessageCircle,
  Bot,
  PieChart,
  TrendingUp,
  Activity,
  UserCheck,
  Megaphone,
  Webhook,
  Globe,
  FormInput,
  BellRing,
  type LucideIcon,
} from "lucide-react";

export type FeatureSection = {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
};

export type FeaturePageData = {
  slug: string;
  icon: LucideIcon;
  title: string;
  shortDescription: string;
  pageTitle: string;
  pageSubtitle: string;
  metaDescription: string;
  sections: FeatureSection[];
  secondaryFeatures: { icon: LucideIcon; title: string; blurb: string }[];
  relatedPages: string[];
};

export const FEATURE_PAGES: FeaturePageData[] = [
  {
    slug: "whatsapp",
    icon: MessageSquare,
    title: "WhatsApp Business",
    shortDescription: "Shared team inbox with templates and interactive messages",
    pageTitle: "WhatsApp Business Integration",
    pageSubtitle:
      "Every customer conversation in one shared team inbox. Reply with templates, send interactive messages, and manage your entire WhatsApp Business presence without switching tools.",
    metaDescription:
      "Shared WhatsApp Business inbox for sales teams. Templates, interactive messages, team assignments, embedded signup, and full conversation context in Tundla CRM.",
    sections: [
      {
        icon: Inbox,
        title: "Shared team inbox",
        description:
          "Your entire team works from one WhatsApp inbox. Every conversation shows the assigned owner, contact details, deal stage, and internal notes — so anyone picking up a chat has full context instantly.",
        points: [
          "Assign chats to teammates and track ownership",
          "Internal notes visible only to your team",
          "Full contact profile and deal history beside every chat",
          "Unread counts and conversation status at a glance",
        ],
      },
      {
        icon: LayoutTemplate,
        title: "Message templates",
        description:
          "Create and manage WhatsApp-approved templates for marketing, utility, and authentication messages. Use header media, quick-reply buttons, and call-to-action buttons to drive engagement.",
        points: [
          "Marketing, utility, and authentication categories",
          "Header images, videos, and documents",
          "Quick-reply and CTA buttons on every template",
          "Template approval status tracking",
        ],
      },
      {
        icon: MessagesSquare,
        title: "Interactive messages",
        description:
          "Go beyond plain text with button replies and list selection messages. Customers tap to respond, making conversations faster and more structured for your team to process.",
        points: [
          "Button reply messages with up to 3 options",
          "List selection messages with up to 10 rows",
          "Reply tracking with full interaction metadata",
          "Media attachments — images, docs, audio, video",
        ],
      },
      {
        icon: Target,
        title: "Meta embedded signup",
        description:
          "Let new users connect their WhatsApp Business number through Meta's embedded signup flow right inside the CRM. Link Facebook Pages, sync lead forms, and auto-create contacts from every lead ad submission.",
        points: [
          "One-click WhatsApp Business connection via Meta",
          "Facebook Page linking with lead form sync",
          "Auto-create contacts and deals from lead ads",
          "Field mapping from Facebook forms to CRM fields",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: Send,
        title: "Quick replies",
        blurb: "Save frequent responses and send them in a tap to speed up conversations.",
      },
      {
        icon: UserPlus,
        title: "Auto-contact creation",
        blurb: "New WhatsApp conversations automatically create contact records in your CRM.",
      },
      {
        icon: CheckCircle2,
        title: "Delivery tracking",
        blurb: "See sent, delivered, read, and failed status for every message.",
      },
    ],
    relatedPages: ["gmail", "automations", "integrations"],
  },
  {
    slug: "gmail",
    icon: Mail,
    title: "Gmail Integration",
    shortDescription: "Send, receive, and track emails right from the CRM",
    pageTitle: "Gmail Integration",
    pageSubtitle:
      "Connect your Gmail account and send, track, and organize emails without ever leaving the CRM. Every email is linked to the right contact and deal automatically.",
    metaDescription:
      "Gmail integration for Tundla CRM. Send and track emails, monitor opens, link conversations to deals, and manage your inbox alongside WhatsApp in one workspace.",
    sections: [
      {
        icon: Send,
        title: "Send emails from the CRM",
        description:
          "Compose and send emails to any contact directly from their profile or deal page. Every sent email is logged with thread ID, timestamps, and delivery status — so your team always knows what was communicated.",
        points: [
          "Send from your connected Gmail address",
          "CC and BCC support for every email",
          "Full audit log with thread and message IDs",
          "Email status tracking — sent, failed, bounced",
        ],
      },
      {
        icon: Inbox,
        title: "Inbox monitoring",
        description:
          "Incoming emails from known contacts are cached and surfaced in the CRM. See email snippets, mark messages as read, and keep your team in sync without juggling tabs between Gmail and your CRM.",
        points: [
          "Inbound email detection for known contacts",
          "Snippet previews without leaving the CRM",
          "Read/unread status management",
          "Emails linked to contacts and deals automatically",
        ],
      },
      {
        icon: ExternalLink,
        title: "OAuth connection",
        description:
          "Connect Gmail securely with Google OAuth — no passwords stored, no app-specific passwords needed. Encrypted token storage ensures your credentials are safe, and you can disconnect anytime with one click.",
        points: [
          "Secure Google OAuth authentication",
          "Encrypted token storage (AES-256-GCM)",
          "One-click connect and disconnect",
          "Scoped access — only the permissions you need",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: Bell,
        title: "Email notifications",
        blurb: "Get notified in-app when contacts reply to your emails.",
      },
      {
        icon: FileText,
        title: "Email in proposals",
        blurb: "Send proposals directly via email with tracked delivery.",
      },
      {
        icon: Users,
        title: "Team visibility",
        blurb: "Everyone on the deal can see the full email history with a contact.",
      },
    ],
    relatedPages: ["whatsapp", "leads-contacts", "proposals"],
  },
  {
    slug: "leads-contacts",
    icon: Users,
    title: "Leads & Contacts",
    shortDescription: "Lead status, custom fields, tags, and bulk actions",
    pageTitle: "Lead & Contact Management",
    pageSubtitle:
      "Every lead, every detail, every interaction — organized and searchable. Qualify leads, track custom fields, tag and segment contacts, and take bulk actions to keep your pipeline clean.",
    metaDescription:
      "Lead and contact management in Tundla CRM. Lead status tracking, custom fields, tags, notes, contact merge, bulk actions, and click-to-call telephony.",
    sections: [
      {
        icon: Target,
        title: "Lead status tracking",
        description:
          "Classify every contact with a lead status — New, Contacted, Qualified, Unqualified, or Junk. Filter your views by status to focus on the leads most likely to convert, and update status as conversations progress.",
        points: [
          "Five lead statuses — New, Contacted, Qualified, Unqualified, Junk",
          "Filter and sort contacts by status",
          "Visual status badges on every contact card",
          "Track the full qualification journey",
        ],
      },
      {
        icon: SlidersHorizontal,
        title: "Custom fields",
        description:
          "Every business tracks different data. Create custom fields for contacts and deals — text, number, dropdown, multi-select, or file uploads. Map them from webhooks and lead forms so incoming data lands in the right place.",
        points: [
          "Five field types — text, number, select, multi-select, file",
          "Scoped to contacts or deals independently",
          "Auto-mapped from webhooks and lead forms",
          "Displayed on contact and deal detail pages",
        ],
      },
      {
        icon: Tags,
        title: "Tags and segmentation",
        description:
          "Organize contacts with color-coded tags. Apply them manually, in bulk, or automatically via automation rules. Use tags to filter views, build broadcast audiences, and trigger flows.",
        points: [
          "Color-coded tags for instant recognition",
          "Bulk tag application across selected contacts",
          "Tag-based automation triggers",
          "Filter contact lists and broadcast audiences by tag",
        ],
      },
      {
        icon: Phone,
        title: "Click-to-call telephony",
        description:
          "Initiate calls directly from any contact card with integrated telephony. Call logs, recordings, and duration are captured automatically and linked to followup records for a complete interaction history.",
        points: [
          "One-click calling from contact profiles",
          "Call recording and duration tracking",
          "Automatic call log creation",
          "Link calls to followup records",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: Search,
        title: "Smart search",
        blurb: "Search contacts by name, phone, email, company, or any custom field.",
      },
      {
        icon: UserPlus,
        title: "Contact merge",
        blurb: "Deduplicate your database by merging contacts with a single action.",
      },
      {
        icon: FileText,
        title: "Notes & history",
        blurb: "Add team notes, track every interaction, and see the full contact timeline.",
      },
    ],
    relatedPages: ["sales-pipeline", "whatsapp", "integrations"],
  },
  {
    slug: "sales-pipeline",
    icon: KanbanSquare,
    title: "Sales Pipeline",
    shortDescription: "Kanban stages, deal tracking, and followup reminders",
    pageTitle: "Visual Sales Pipeline",
    pageSubtitle:
      "See every deal at a glance on a Kanban board. Drag deals across custom stages, set values and close dates, schedule reminders, and never let a follow-up slip through the cracks.",
    metaDescription:
      "Visual sales pipeline in Tundla CRM. Drag-and-drop Kanban board, deal tracking, expected close dates, followup reminders, lost reasons, and revenue forecasting.",
    sections: [
      {
        icon: GripVertical,
        title: "Drag-and-drop Kanban",
        description:
          "Build pipelines that match how you actually sell. Create custom stages with colors, drag deals between them, and see stage totals update in real time. Every deal shows its value, owner, expected close date, and age at a glance.",
        points: [
          "Unlimited custom stages with color coding",
          "Drag-and-drop deal movement",
          "Stage totals and deal count in real time",
          "Deal value, owner, and close date on every card",
        ],
      },
      {
        icon: Clock,
        title: "Followups & reminders",
        description:
          "Never forget a follow-up. Set reminders for calls, meetings, emails, or custom tasks on any contact or deal. Reminders are auto-seeded when you create a new deal, and overdue items trigger notifications so nothing falls through the cracks.",
        points: [
          "Reminder types — call, meeting, email, followup, other",
          "Auto-seeded reminders on new deal creation",
          "Overdue and due-today notifications",
          "Followup outcome tracking — connected, no answer, callback, interested",
        ],
      },
      {
        icon: CircleDollarSign,
        title: "Deal tracking & history",
        description:
          "Every deal carries its full story — value, currency, expected close date, custom fields, notes, and a complete audit trail. When a deal is won or lost, capture the reason and who closed it for cleaner reporting.",
        points: [
          "Deal value with currency tracking",
          "Expected close date and deal age",
          "Win/loss status with reason tracking",
          "Full audit trail — who changed what, and when",
        ],
      },
      {
        icon: CalendarCheck,
        title: "Closed deals archive",
        description:
          "Won and lost deals move to a dedicated archive so your active pipeline stays clean. Filter by status, date range, owner, or lost reason to understand what's working and what needs attention.",
        points: [
          "Separate view for won and lost deals",
          "Filter by date, owner, stage, or lost reason",
          "Track who closed each deal and when",
          "Five default lost reasons plus custom ones",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: Bell,
        title: "Stage change alerts",
        blurb: "Get notified when deals move stages or hit milestones.",
      },
      {
        icon: Users,
        title: "Deal assignment",
        blurb: "Assign deals to team members with round-robin or manual control.",
      },
      {
        icon: FileBarChart,
        title: "Pipeline reports",
        blurb: "Conversion funnels, velocity, and forecast reports built from pipeline data.",
      },
    ],
    relatedPages: ["leads-contacts", "proposals", "reports"],
  },
  {
    slug: "proposals",
    icon: FileText,
    title: "Proposals & Catalog",
    shortDescription: "Create proposals, share catalogs, and close deals faster",
    pageTitle: "Proposals & Product Catalog",
    pageSubtitle:
      "Build professional proposals in minutes, share them via email or WhatsApp, and know exactly when your client views, accepts, or rejects them. Pull items from your product catalog to keep pricing consistent.",
    metaDescription:
      "Proposal builder and product catalog in Tundla CRM. Create proposals with line items, send via email or WhatsApp, track client views, and manage your product catalog.",
    sections: [
      {
        icon: FileText,
        title: "Proposal builder",
        description:
          "Create polished proposals with line items pulled from your product catalog or entered manually. Set quantities, unit prices, discounts, and tax rates. Add terms and conditions, set a validity date, and generate a shareable link or PDF in one click.",
        points: [
          "Line items with quantity, price, discount, and tax",
          "Automatic subtotal and total calculation",
          "Terms and conditions with validity dates",
          "PDF generation and shareable public links",
        ],
      },
      {
        icon: ExternalLink,
        title: "Client portal",
        description:
          "Every proposal gets a unique public link. Your client opens it without logging in, reviews the details, and accepts or rejects with one click. You get notified instantly and see exactly when they viewed it.",
        points: [
          "Public access via secure token — no login required",
          "One-click accept or reject for clients",
          "View, acceptance, and rejection timestamps",
          "Instant notifications when a client takes action",
        ],
      },
      {
        icon: ShoppingBag,
        title: "Product catalog",
        description:
          "Maintain a centralized product catalog with names, descriptions, images, pricing, and categories. When building proposals or linking items to deals, pull from the catalog to keep pricing consistent and up to date.",
        points: [
          "Product name, description, price, and unit",
          "Category organization with sort ordering",
          "Active/inactive status for seasonal items",
          "Link catalog items to deals and proposals",
        ],
      },
      {
        icon: Send,
        title: "Send via any channel",
        description:
          "Share proposals with clients over email or WhatsApp using editable templates with merge fields. Track delivery and see the full send history — who sent it, when, and through which channel.",
        points: [
          "Send via email or WhatsApp with one click",
          "Editable templates with contact and deal variables",
          "Full send history with channel and timestamp",
          "Proposal status flow — draft, sent, viewed, accepted, rejected",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: CircleDollarSign,
        title: "Tax & discounts",
        blurb: "Per-line-item discounts and tax calculations with automatic totals.",
      },
      {
        icon: FileBarChart,
        title: "Proposal analytics",
        blurb: "Track proposal conversion rates and average time to acceptance.",
      },
      {
        icon: CheckCircle2,
        title: "Status tracking",
        blurb: "Draft → Sent → Viewed → Accepted/Rejected — see every step.",
      },
    ],
    relatedPages: ["sales-pipeline", "gmail", "whatsapp"],
  },
  {
    slug: "automations",
    icon: Workflow,
    title: "Automations & Flows",
    shortDescription: "Trigger-based rules and visual WhatsApp chatbots",
    pageTitle: "Automations & Conversational Flows",
    pageSubtitle:
      "Automate the repetitive work that slows your team down. Set up trigger-based rules for lead routing, follow-ups, and tagging — or build visual WhatsApp chatbots that qualify leads while you sleep.",
    metaDescription:
      "Automations and chatbot flows in Tundla CRM. Trigger-based rules, keyword matching, multi-step flows, WhatsApp chatbot builder, and execution logging.",
    sections: [
      {
        icon: Zap,
        title: "Trigger-based automations",
        description:
          "Create rules that fire on specific events — a new message, a keyword match, a new contact, a tag addition, or a time schedule. Each rule runs a sequence of actions: send a message, assign a conversation, tag a contact, create a deal, fire a webhook, or wait before the next step.",
        points: [
          "Triggers — new message, keyword, new contact, tag, cron schedule",
          "Actions — send message, assign, tag, create deal, webhook, wait",
          "Condition branching based on contact fields, tags, or time",
          "Execution count tracking and detailed run logs",
        ],
      },
      {
        icon: Bot,
        title: "Visual chatbot builder",
        description:
          "Design multi-step WhatsApp conversation flows with a visual builder. Send text, buttons, or list messages, collect user input into variables, branch on conditions, and hand off to a human agent when the bot reaches its limits.",
        points: [
          "Node types — message, buttons, list, collect input, condition, handoff",
          "Variable storage and interpolation across steps",
          "Fallback policy with reprompt limits and timeouts",
          "One-click agent handoff with optional assignment",
        ],
      },
      {
        icon: GitBranch,
        title: "Condition branching",
        description:
          "Add intelligent decision points to both automations and flows. Branch based on contact field values, tag presence, message content, or time of day — so the right contacts get the right treatment automatically.",
        points: [
          "Branch on contact field equals or contains",
          "Check for tag presence or absence",
          "Match message content patterns",
          "Time-of-day conditions for business hours routing",
        ],
      },
      {
        icon: Activity,
        title: "Execution logs",
        description:
          "Every automation and flow run is logged step by step — what triggered it, which actions ran, which were skipped, and what failed. Debug issues instantly and understand exactly how your automations behave in production.",
        points: [
          "Step-by-step execution trace for every run",
          "Success, skipped, and failed status per step",
          "Error messages on failed actions",
          "Duplicate and edit automations with one click",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: MessageCircle,
        title: "Keyword matching",
        blurb: "Trigger automations on exact or partial keyword matches in messages.",
      },
      {
        icon: Clock,
        title: "Scheduled triggers",
        blurb: "Run automations on a cron schedule — daily, hourly, or custom intervals.",
      },
      {
        icon: UserCheck,
        title: "Round-robin assignment",
        blurb: "Distribute incoming conversations evenly across your team automatically.",
      },
    ],
    relatedPages: ["whatsapp", "leads-contacts", "integrations"],
  },
  {
    slug: "reports",
    icon: BarChart3,
    title: "Reports & Analytics",
    shortDescription: "Revenue forecasts, pipeline metrics, and team performance",
    pageTitle: "Reports & Analytics Dashboard",
    pageSubtitle:
      "Eight built-in reports give you a complete picture of your sales operation. See conversion funnels, revenue forecasts, deal velocity, source ROI, and team performance — all filterable by date range and scoped by role.",
    metaDescription:
      "Sales reports and analytics in Tundla CRM. Deal conversion funnels, revenue forecasts, deal velocity, source ROI, lost analysis, and employee performance dashboards.",
    sections: [
      {
        icon: PieChart,
        title: "Deal conversion funnel",
        description:
          "See exactly where deals drop off in your pipeline. The conversion funnel shows how many deals enter each stage, how many move forward, and the conversion rate between stages — so you know where to focus your team's effort.",
        points: [
          "Stage-by-stage conversion rates",
          "Visual funnel with deal counts and values",
          "Filter by date range, owner, or source",
          "Compare periods to spot trends",
        ],
      },
      {
        icon: TrendingUp,
        title: "Revenue forecast",
        description:
          "Project future revenue based on your current pipeline. See expected close values by month, weighted by deal stage probability, so you can plan hiring, inventory, and cash flow with confidence.",
        points: [
          "Monthly projected revenue from open deals",
          "Stage-weighted probability calculations",
          "Filter by owner, source, or pipeline",
          "Actual vs. forecast comparison",
        ],
      },
      {
        icon: Activity,
        title: "Source ROI & velocity",
        description:
          "Understand which lead sources generate the most revenue and which move fastest through your pipeline. Measure time-in-stage, deal velocity, and source-level ROI to double down on what works.",
        points: [
          "Revenue and deal count per lead source",
          "Average time in each pipeline stage",
          "Deal velocity — days from creation to close",
          "Source ROI to guide marketing spend",
        ],
      },
      {
        icon: UserCheck,
        title: "Team performance",
        description:
          "See how each salesperson is performing. Track deals won, revenue generated, follow-up activity, response times, and conversion rates per team member — scoped by role so managers see their team and admins see everyone.",
        points: [
          "Deals, revenue, and activity per team member",
          "Follow-up completion and outcome tracking",
          "Lost deal analysis by reason and owner",
          "Role-scoped dashboards — admin, manager, executive",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: CalendarCheck,
        title: "Date range filters",
        blurb: "Filter every report by custom date ranges for precise analysis.",
      },
      {
        icon: FileBarChart,
        title: "Activity reports",
        blurb: "Track contacts created, messages sent, and deals moved over time.",
      },
      {
        icon: Target,
        title: "Targets & SLAs",
        blurb: "Set team targets and response time SLAs with breach notifications.",
      },
    ],
    relatedPages: ["sales-pipeline", "leads-contacts", "integrations"],
  },
  {
    slug: "integrations",
    icon: Plug,
    title: "Integrations",
    shortDescription: "Webhooks, broadcasts, embeddable forms, and notifications",
    pageTitle: "Integrations & Multichannel Tools",
    pageSubtitle:
      "Connect any lead source, broadcast campaigns to segmented audiences, embed forms on your website, and keep your team notified across in-app, email, and WhatsApp channels.",
    metaDescription:
      "Integrations in Tundla CRM. Custom webhooks, lead fetch sources, WhatsApp broadcasts, embeddable forms, and multi-channel notifications for your sales team.",
    sections: [
      {
        icon: Megaphone,
        title: "WhatsApp broadcasts",
        description:
          "Send targeted WhatsApp campaigns to segmented audiences using approved templates. Schedule sends, track delivery in real time, and measure opens, reads, and replies — without spamming your contact list.",
        points: [
          "Audience segmentation by tags, status, or custom filters",
          "Scheduled and immediate send options",
          "Real-time delivery analytics — sent, delivered, read, replied",
          "Template variable substitution for personalization",
        ],
      },
      {
        icon: Webhook,
        title: "Custom webhooks",
        description:
          "Create webhooks for any platform — website forms, Zapier, Make, or any tool that sends HTTP requests. Map incoming JSON fields to contact and deal properties, set up round-robin assignment, and let leads flow in automatically.",
        points: [
          "Public or secret-authenticated endpoints",
          "JSON field mapping to contacts and deals",
          "Round-robin team member assignment",
          "Rate limiting and request history audit log",
        ],
      },
      {
        icon: Globe,
        title: "Fetch sources",
        description:
          "Pull leads from external APIs on a schedule — every 1, 5, 10, or 20 minutes. Configure GET or POST requests with dynamic parameters, parse JSON responses, and deduplicate incoming leads by provider ID.",
        points: [
          "Scheduled polling at configurable intervals",
          "GET and POST request support with custom headers",
          "JSON response parsing with dot-path navigation",
          "Deduplication by external reference ID",
        ],
      },
      {
        icon: FormInput,
        title: "Embeddable forms",
        description:
          "Embed lead capture forms on your website, landing pages, or anywhere you can paste an HTML snippet. Submissions create contacts and deals in the CRM instantly — no authentication required from the visitor.",
        points: [
          "Public form submissions without authentication",
          "Auto-create contacts and deals from every submission",
          "Custom field mapping for form inputs",
          "Embed anywhere with a simple URL or iframe",
        ],
      },
    ],
    secondaryFeatures: [
      {
        icon: BellRing,
        title: "Multi-channel notifications",
        blurb:
          "16 event types with editable templates across in-app, email, and WhatsApp.",
      },
      {
        icon: UserCheck,
        title: "3-role access control",
        blurb:
          "Admin, Manager, and Executive roles with row-level security on every record.",
      },
      {
        icon: Activity,
        title: "Audit logging",
        blurb:
          "Full audit trail for webhooks, automations, proposals, and team actions.",
      },
    ],
    relatedPages: ["whatsapp", "automations", "leads-contacts"],
  },
];
