# Design system

The app uses [shadcn/ui](https://ui.shadcn.com) (style `radix-nova`, Radix primitives, lucide icons, Geist font) on Tailwind CSS v4. Tokens live in `src/index.css`.

## Principles

- **Quiet surfaces, one action color.** Neutral stone backgrounds and white cards; Italian green (`primary`) is the only color for primary actions and "active" state. Flag red (`destructive`) is only for destructive actions, errors and unread counts.
- **Color means something.** Leave types and request statuses each have exactly one color, used everywhere (calendar, badges, legends). Never pick ad-hoc hex colors.
- **Sentence case, plain words.** "Request time off", not "SUBMIT REQUEST". No all-caps labels, no emoji in UI chrome, no "→" on buttons. Buttons say what happens ("Approve", "Send request"); the matching toast uses the same verb ("Request sent").
- **Errors and empty states give direction.** Say what happened and what to do next. Empty lists get an `EmptyState`, with an action when one exists.
- **Mobile first.** Staff mostly use phones. Forms open as a bottom drawer on mobile and a dialog on desktop (`ResponsiveDialog`). Touch targets at least 40px high.

## Tokens (Tailwind classes)

| Purpose | Classes |
| --- | --- |
| Page / card / muted surface | `bg-background`, `bg-card`, `bg-muted` |
| Text | `text-foreground`, `text-muted-foreground` |
| Primary action / active | `bg-primary text-primary-foreground`, `text-primary` |
| Destructive | `text-destructive`, `bg-destructive/10` |
| Status | `text-success`, `text-warning`, `text-info` (+ `/10`–`/15` tinted backgrounds) |
| Leave types | `bg-leave-day-off`, `bg-leave-vacation`, `bg-leave-sick`, `bg-leave-auto`, `bg-leave-special` (and `text-*`, `/12` tints) |

Dark mode is the `.dark` class on `<html>` (light / dark / system, see `components/theme`). Never branch on theme in components; tokens handle it.

## Building blocks

shadcn primitives are in `src/components/ui/*` (button, card, badge, input, textarea, select, dialog, drawer, sheet, tabs, table, avatar, dropdown-menu, popover, calendar, tooltip, switch, checkbox, radio-group, toggle-group, alert, alert-dialog, progress, skeleton, spinner, empty, field, item, scroll-area, separator, sidebar, sonner).

App-level components in `src/components/shared/`:

- `PageHeader` — title, description, actions, optional `onBack`. One per screen.
- `StatCard` — one metric; `tone` colors the value only.
- `EmptyState` — icon, title, description, action.
- `UserAvatar` — initials avatar.
- `ResponsiveDialog` — dialog on desktop, drawer on mobile; pass `footer` for actions.
- `LoadingState` — spinner + label.

Leave vocabulary in `src/features/leave/leaveMeta.tsx`: `LeaveStatusBadge`, `LeaveTypeBadge`, `LeaveTypeDot`, `leaveTypeMeta()` (label, lucide icon, color classes), `formatShortDate()`.

Feedback: `import { toast } from 'sonner'` for transient confirmations and errors; `Alert` for inline, persistent problems; `AlertDialog` to confirm destructive actions.

## Layout

- `components/layout/AppShell` renders a collapsible `Sidebar` on desktop (≥1024px) and a top bar + bottom tab bar on mobile. Navigation lives in `components/layout/navigation.ts`.
- Pages render inside `<main>` with its own padding; a page starts with `PageHeader` and uses `space-y-6` between sections.
- Group related content in `Card`; don't nest cards in cards. Use `Item`/list rows for lists, `Table` for dense admin data on desktop.
