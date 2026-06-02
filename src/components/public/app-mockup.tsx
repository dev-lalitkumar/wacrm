import {
  Inbox,
  KanbanSquare,
  Megaphone,
  Users,
  BarChart3,
  Search,
  Phone,
  Video,
  Send,
  CheckCheck,
  Paperclip,
} from 'lucide-react';
import { LogoMark } from './logo';
import { cn } from '@/lib/utils';

/**
 * A faux Tundla CRM "WhatsApp inbox" rendered entirely in HTML/CSS so it
 * stays razor-sharp at any resolution, matches the brand, and showcases the
 * actual product surface. Used as the hero visual and on the features page.
 */

const CONVERSATIONS = [
  {
    name: 'Aarav Mehta',
    msg: 'Great, send me the proposal 🙌',
    time: '2m',
    unread: 2,
    active: true,
    tag: 'Hot lead',
  },
  {
    name: 'Sofia Rossi',
    msg: 'Is the enterprise plan monthly?',
    time: '14m',
    unread: 0,
    active: false,
  },
  {
    name: "Liam O'Connor",
    msg: 'Thanks for the quick demo!',
    time: '1h',
    unread: 0,
    active: false,
  },
  {
    name: 'Priya Nair',
    msg: 'Voice note (0:42)',
    time: '3h',
    unread: 0,
    active: false,
  },
  {
    name: 'Noah Williams',
    msg: "We'll sign this week.",
    time: '1d',
    unread: 0,
    active: false,
  },
];

const THREAD = [
  {
    from: 'them',
    text: 'Hi! Saw your ad on Instagram — interested in the Pro plan.',
    time: '10:24',
  },
  {
    from: 'me',
    text: "Welcome 👋 Happy to help. I've added you to our pipeline.",
    time: '10:25',
  },
  { from: 'them', text: 'Great, send me the proposal 🙌', time: '10:27' },
  {
    from: 'me',
    text: 'On its way — sharing the catalog + pricing now.',
    time: '10:27',
  },
];

const NAV = [
  { icon: Inbox, active: true },
  { icon: KanbanSquare, active: false },
  { icon: Megaphone, active: false },
  { icon: Users, active: false },
  { icon: BarChart3, active: false },
];

export function AppMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12] shadow-2xl ring-1 shadow-black/60 ring-white/5',
        className
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3">
        <span className="size-3 rounded-full bg-red-400/80" />
        <span className="size-3 rounded-full bg-yellow-400/80" />
        <span className="size-3 rounded-full bg-green-400/80" />
        <div className="text-muted-foreground ml-3 flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-[11px]">
          app.crm.tundla.com/inbox
        </div>
      </div>

      <div className="flex h-[420px] text-left">
        {/* Rail */}
        <div className="hidden w-14 flex-col items-center gap-1 border-r border-white/5 bg-white/[0.02] py-4 sm:flex">
          <LogoMark size={30} className="mb-3" />
          {NAV.map(({ icon: Icon, active }, i) => (
            <span
              key={i}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg',
                active ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          ))}
        </div>

        {/* Conversation list */}
        <div className="hidden w-60 flex-col border-r border-white/5 md:flex">
          <div className="border-b border-white/5 p-3">
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs">
              <Search className="size-3.5" />
              Search conversations
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {CONVERSATIONS.map((c) => (
              <div
                key={c.name}
                className={cn(
                  'flex items-start gap-3 border-b border-white/5 px-3 py-3',
                  c.active && 'bg-primary/10'
                )}
              >
                <span className="from-primary/40 flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br to-indigo-500/30 text-xs font-semibold text-white">
                  {c.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground truncate text-[13px] font-medium">
                      {c.name}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {c.time}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {c.msg}
                  </p>
                  {c.tag && (
                    <span className="bg-primary/20 text-primary mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium">
                      {c.tag}
                    </span>
                  )}
                </div>
                {c.unread > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div className="flex flex-1 flex-col bg-[#0a0a10]">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="from-primary/40 flex size-9 items-center justify-center rounded-full bg-gradient-to-br to-indigo-500/30 text-xs font-semibold text-white">
                AM
              </span>
              <div>
                <p className="text-foreground text-[13px] font-medium">
                  Aarav Mehta
                </p>
                <p className="text-[10px] text-green-400">online</p>
              </div>
            </div>
            <div className="text-muted-foreground flex items-center gap-3">
              <Phone className="size-4" />
              <Video className="size-4" />
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-hidden p-4">
            {THREAD.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  m.from === 'me' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed',
                    m.from === 'me'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'text-foreground rounded-bl-sm bg-white/8'
                  )}
                >
                  {m.text}
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center gap-0.5 text-[9px]',
                      m.from === 'me'
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    )}
                  >
                    {m.time}
                    {m.from === 'me' && <CheckCheck className="size-3" />}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-white/5 p-3">
            <Paperclip className="text-muted-foreground size-4" />
            <div className="text-muted-foreground flex-1 rounded-full bg-white/5 px-4 py-2 text-[12px]">
              Type a message…
            </div>
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full">
              <Send className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
