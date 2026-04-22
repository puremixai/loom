# Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain "LOOM" text in the navbar with the weave-icon + all-lowercase wordmark logo, add the logo to the projects empty state, and wire up an SVG favicon.

**Architecture:** A single `loom-icon.tsx` component file exports `LoomIcon` (icon-only) and `LoomLogo` (icon + wordmark). All size/typography tokens live in a lookup table inside that file. Three call-sites are updated: `App.tsx` navbar, `ProjectsPage.tsx` empty state, and `index.html` favicon.

**Tech Stack:** React 18, TypeScript (strict), Tailwind CSS, Geist Sans (Google Fonts, already loaded), inline SVG.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| **Create** | `packages/web/src/components/ui/loom-icon.tsx` | `LoomIcon` + `LoomLogo` components |
| **Modify** | `packages/web/src/App.tsx` | Replace text-only nav logo |
| **Modify** | `packages/web/src/pages/ProjectsPage.tsx` | Add logo to empty state |
| **Create** | `packages/web/public/favicon.svg` | SVG favicon (32×32) |
| **Modify** | `packages/web/index.html` | Wire up favicon link |

---

## Task 1: Create `LoomIcon` and `LoomLogo` components

**Files:**
- Create: `packages/web/src/components/ui/loom-icon.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// packages/web/src/components/ui/loom-icon.tsx
import { cn } from '@/lib/utils';

const SCALE = {
  xl: { icon: 48, fontSize: 38, letterSpacing: '-0.055em', gap: 16 },
  lg: { icon: 36, fontSize: 28, letterSpacing: '-0.05em',  gap: 13 },
  md: { icon: 24, fontSize: 20, letterSpacing: '-0.04em',  gap: 10 },
  sm: { icon: 20, fontSize: 15, letterSpacing: '-0.04em',  gap: 8  },
  xs: { icon: 16, fontSize: 0,  letterSpacing: '',          gap: 0  },
} as const;

const STROKE: Record<number, number> = {
  48: 2.0,
  36: 2.2,
  24: 2.4,
  20: 2.6,
  16: 3.0,
};

export type LoomLogoSize = keyof typeof SCALE;

interface LoomIconProps {
  size: number;
  className?: string;
}

export function LoomIcon({ size, className }: LoomIconProps) {
  const sw = STROKE[size] ?? 2.2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Warp (vertical threads) */}
      <line x1="13" y1="6"  x2="13" y2="38" stroke="#171717" strokeWidth={sw} strokeLinecap="round" />
      <line x1="22" y1="6"  x2="22" y2="38" stroke="#171717" strokeWidth={sw} strokeLinecap="round" />
      <line x1="31" y1="6"  x2="31" y2="38" stroke="#171717" strokeWidth={sw} strokeLinecap="round" />
      {/* Weft row 1: warp-on-top at v1 and v3, weft-on-top at v2 */}
      <line x1="6"  y1="15" x2="11" y2="15" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      <line x1="15" y1="15" x2="29" y2="15" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      <line x1="33" y1="15" x2="38" y2="15" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      {/* Weft row 2: weft-on-top at v1 and v3, warp-on-top at v2 */}
      <line x1="6"  y1="22" x2="15" y2="22" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      <line x1="20" y1="22" x2="38" y2="22" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      {/* Weft row 3: warp-on-top at v1 and v3, weft-on-top at v2 */}
      <line x1="6"  y1="29" x2="11" y2="29" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      <line x1="15" y1="29" x2="29" y2="29" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      <line x1="33" y1="29" x2="38" y2="29" stroke="#0a72ef" strokeWidth={sw} strokeLinecap="round" />
      {/* White covers at warp-on-top intersections (simulates weave depth) */}
      <rect x="11" y="13" width="4" height="4" fill="#ffffff" />
      <rect x="29" y="13" width="4" height="4" fill="#ffffff" />
      <rect x="20" y="20" width="4" height="4" fill="#ffffff" />
      <rect x="11" y="27" width="4" height="4" fill="#ffffff" />
      <rect x="29" y="27" width="4" height="4" fill="#ffffff" />
    </svg>
  );
}

interface LoomLogoProps {
  size: LoomLogoSize;
  className?: string;
}

export function LoomLogo({ size, className }: LoomLogoProps) {
  const { icon, fontSize, letterSpacing, gap } = SCALE[size];
  return (
    <div className={cn('flex items-center', className)} style={{ gap }}>
      <LoomIcon size={icon} />
      {fontSize > 0 && (
        <span style={{ fontSize, fontWeight: 600, letterSpacing, lineHeight: 1, color: '#171717' }}>
          loom
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/ui/loom-icon.tsx
git commit -m "feat: add LoomIcon and LoomLogo components"
```

---

## Task 2: Update navbar in `App.tsx`

**Files:**
- Modify: `packages/web/src/App.tsx`

The current logo is a plain `<NavLink>` with text. Replace it with `<LoomLogo size="sm" />` inside a wrapper NavLink.

- [ ] **Step 1: Update `App.tsx`**

Replace the existing logo NavLink (line 32-34):

```tsx
// Before:
<NavLink to="/" className="font-mono text-xs font-medium uppercase tracking-tight text-ink-900">
  Loom
</NavLink>

// After:
<NavLink to="/" className="flex items-center" aria-label="loom – go to projects">
  <LoomLogo size="sm" />
</NavLink>
```

Add the import at the top of the file (after the existing imports):

```tsx
import { LoomLogo } from './components/ui/loom-icon';
```

Full updated `App.tsx`:

```tsx
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { SkillsPage } from './pages/SkillsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoomLogo } from './components/ui/loom-icon';
import { cn } from '@/lib/utils';

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'text-sm font-medium transition-colors',
          isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-ink-900">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <NavLink to="/" className="flex items-center" aria-label="loom – go to projects">
                <LoomLogo size="sm" />
              </NavLink>
              <nav className="flex items-center gap-5">
                <NavItem to="/">Projects</NavItem>
                <NavItem to="/skills">Skills</NavItem>
                <NavItem to="/settings">Settings</NavItem>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-content px-6 py-10">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:5173`. The navbar should show the weave icon (3 dark vertical lines + 3 blue horizontal lines with over/under pattern) followed by "loom" in 15px Geist 600. The icon should be 20×20px. Clicking it navigates to `/`.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/App.tsx
git commit -m "feat: replace nav text logo with LoomLogo component"
```

---

## Task 3: Add logo to ProjectsPage empty state

**Files:**
- Modify: `packages/web/src/pages/ProjectsPage.tsx`

The empty state (shown when no projects are registered) currently has plain text. Add `<LoomLogo size="lg" />` above it to create a branded zero-data screen.

- [ ] **Step 1: Update `ProjectsPage.tsx`**

Add the import after the existing imports:

```tsx
import { LoomLogo } from '@/components/ui/loom-icon';
```

Replace the empty-state block (lines 70–75):

```tsx
// Before:
{data?.length === 0 && !isLoading && (
  <div className="rounded-lg bg-white py-16 text-center shadow-border">
    <p className="text-base text-ink-900">No projects registered yet</p>
    <p className="mt-1 text-sm text-ink-500">Click "Add Project" above to get started.</p>
  </div>
)}

// After:
{data?.length === 0 && !isLoading && (
  <div className="rounded-lg bg-white py-16 text-center shadow-border">
    <div className="flex justify-center mb-5">
      <LoomLogo size="lg" />
    </div>
    <p className="text-base text-ink-900">No projects registered yet</p>
    <p className="mt-1 text-sm text-ink-500">Click "Add Project" above to get started.</p>
  </div>
)}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify visually**

With the dev server running, remove all projects from the UI (or temporarily force `data?.length === 0` in dev) and confirm the logo appears centered above the empty-state text.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/ProjectsPage.tsx
git commit -m "feat: add LoomLogo to projects empty state"
```

---

## Task 4: Add SVG favicon

**Files:**
- Create: `packages/web/public/favicon.svg`
- Modify: `packages/web/index.html`

Vite serves `packages/web/public/` at `/`. Adding `favicon.svg` there makes it available at `http://localhost:5173/favicon.svg`. The `index.html` `<link rel="icon">` tag tells browsers to use it.

- [ ] **Step 1: Create `packages/web/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 44 44" fill="none">
  <!-- Warp (vertical threads) -->
  <line x1="13" y1="6"  x2="13" y2="38" stroke="#171717" stroke-width="3" stroke-linecap="round"/>
  <line x1="22" y1="6"  x2="22" y2="38" stroke="#171717" stroke-width="3" stroke-linecap="round"/>
  <line x1="31" y1="6"  x2="31" y2="38" stroke="#171717" stroke-width="3" stroke-linecap="round"/>
  <!-- Weft row 1 -->
  <line x1="6"  y1="15" x2="11" y2="15" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <line x1="15" y1="15" x2="29" y2="15" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <line x1="33" y1="15" x2="38" y2="15" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <!-- Weft row 2 -->
  <line x1="6"  y1="22" x2="15" y2="22" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <line x1="20" y1="22" x2="38" y2="22" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <!-- Weft row 3 -->
  <line x1="6"  y1="29" x2="11" y2="29" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <line x1="15" y1="29" x2="29" y2="29" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <line x1="33" y1="29" x2="38" y2="29" stroke="#0a72ef" stroke-width="3" stroke-linecap="round"/>
  <!-- White covers at warp-on-top intersections -->
  <rect x="11" y="13" width="4" height="4" fill="#ffffff"/>
  <rect x="29" y="13" width="4" height="4" fill="#ffffff"/>
  <rect x="20" y="20" width="4" height="4" fill="#ffffff"/>
  <rect x="11" y="27" width="4" height="4" fill="#ffffff"/>
  <rect x="29" y="27" width="4" height="4" fill="#ffffff"/>
</svg>
```

- [ ] **Step 2: Update `packages/web/index.html`**

Add `<link rel="icon">` inside `<head>`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Verify favicon in browser**

With the dev server running, check the browser tab — it should show the weave icon instead of the default Vite favicon. Hard-refresh (`Ctrl+Shift+R`) if the old favicon is cached.

- [ ] **Step 4: Commit**

```bash
git add packages/web/public/favicon.svg packages/web/index.html
git commit -m "feat: add SVG favicon with loom weave icon"
```

---

## Final verification

- [ ] Run full typecheck across all packages:

```bash
pnpm -r run typecheck
```

Expected: no errors.

- [ ] Run backend tests (logo changes don't touch server code, but confirm nothing broke):

```bash
pnpm --filter @loom/server test
```

Expected: 27 tests pass.
