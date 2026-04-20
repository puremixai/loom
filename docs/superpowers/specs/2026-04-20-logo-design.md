# Loom Logo & Typography Display Design

**Date:** 2026-04-20  
**Status:** Approved

## 1. Summary

Loom's logo is a **weave icon + all-lowercase wordmark** combination. The weave icon (经纬交织图案) represents thread organization — a direct visual metaphor for skill weaving. The wordmark uses Geist Sans 600 with tight negative tracking, consistent with the Vercel/Geist design system already in the app.

## 2. Logo Mark — The Weave Icon

### Concept

A 3×3 warp/weft grid rendered as SVG lines:

- **Warp threads** (vertical, 3 lines): color `#171717` — the structure
- **Weft threads** (horizontal, 3 lines): color `#0a72ef` — the motion / brand accent
- **Weave pattern**: alternating over/under at each intersection, achieved via white `rect` covers on the background color

### SVG Canonical Form (44×44 viewBox)

```svg
<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Warp (vertical) -->
  <line x1="13" y1="6"  x2="13" y2="38" stroke="#171717" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="22" y1="6"  x2="22" y2="38" stroke="#171717" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="31" y1="6"  x2="31" y2="38" stroke="#171717" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Weft row 1: under v1, over v2, under v3 -->
  <line x1="6"  y1="15" x2="11" y2="15" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="15" y1="15" x2="29" y2="15" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="33" y1="15" x2="38" y2="15" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Weft row 2: over v1, under v2, over v3 -->
  <line x1="6"  y1="22" x2="15" y2="22" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="20" y1="22" x2="38" y2="22" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Weft row 3: under v1, over v2, under v3 -->
  <line x1="6"  y1="29" x2="11" y2="29" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="15" y1="29" x2="29" y2="29" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="33" y1="29" x2="38" y2="29" stroke="#0a72ef" stroke-width="2.2" stroke-linecap="round"/>
  <!-- White covers: warp-on-top intersections -->
  <rect x="11" y="13" width="4" height="4" fill="var(--logo-bg, #ffffff)"/>
  <rect x="29" y="13" width="4" height="4" fill="var(--logo-bg, #ffffff)"/>
  <rect x="20" y="20" width="4" height="4" fill="var(--logo-bg, #ffffff)"/>
  <rect x="11" y="27" width="4" height="4" fill="var(--logo-bg, #ffffff)"/>
  <rect x="29" y="27" width="4" height="4" fill="var(--logo-bg, #ffffff)"/>
</svg>
```

The `fill="var(--logo-bg, #ffffff)"` on white covers means the icon only works on a white background by default. If the icon is placed on a non-white surface, set `--logo-bg` to match.

### Implementation

The icon is implemented as a React component `LoomIcon` in `packages/web/src/components/ui/loom-icon.tsx`, accepting a `size` prop (pixels). The `stroke-width` scales inversely with rendered size via a lookup table (see §3).

## 3. Size Scale

All sizes share the same 44×44 viewBox. The `width`/`height` attribute on the `<svg>` element controls rendered size.

| Token | Icon size | Text size | Letter-spacing | Gap  | Context                  |
|-------|-----------|-----------|----------------|------|--------------------------|
| `xl`  | 48px      | 38px      | −0.055em       | 16px | Splash / loading screen  |
| `lg`  | 36px      | 28px      | −0.05em        | 13px | Page header / empty state|
| `md`  | 24px      | 20px      | −0.04em        | 10px | Card title / section     |
| `sm`  | 20px      | 15px      | −0.04em        | 8px  | Navigation bar           |
| `xs`  | 16px      | —         | —              | —    | Icon-only / favicon      |

Stroke-width by size (keeps visual weight consistent):

| Icon size | stroke-width |
|-----------|-------------|
| 48px      | 2.0         |
| 36px      | 2.2         |
| 24px      | 2.4         |
| 20px      | 2.6         |
| 16px      | 3.0         |

## 4. Wordmark Typography

- **Font:** Geist Sans (already loaded via Google Fonts in `index.css`)
- **Weight:** 600
- **Case:** all-lowercase — always `loom`, never `Loom` or `LOOM`
- **Letter-spacing:** negative, scales with size (see table above)
- **Color:** `#171717` (ink-900)
- **Line-height:** 1

## 5. Color Tokens

| Name   | Value     | Role                                   |
|--------|-----------|----------------------------------------|
| Warp   | `#171717` | Vertical threads; wordmark color       |
| Weft   | `#0a72ef` | Horizontal threads; brand accent       |
| Canvas | `#ffffff` | Page background; weave intersection fill |
| Tagline| `#4d4d4d` | Descriptive text below logo in splash  |

The Weft color (`#0a72ef`) is the existing "Develop Blue" accent already defined in `docs/DESIGN.md`. No new color token is introduced.

## 6. Component API

```tsx
// LoomLogo — icon + wordmark combination
<LoomLogo size="sm" />   // navbar
<LoomLogo size="xl" />   // splash

// LoomIcon — icon only
<LoomIcon size={16} />   // favicon context
```

`LoomLogo` renders a flex row (items-center) with the icon and the `<span>loom</span>` wordmark. Size tokens map to the table in §3.

## 7. Usage Contexts

| Context              | Component            | Size token |
|----------------------|----------------------|------------|
| Navigation bar       | `<LoomLogo>`         | `sm`       |
| Splash / loading     | `<LoomLogo>`         | `xl`       |
| Empty state (page)   | `<LoomLogo>`         | `lg`       |
| Card / section title | `<LoomLogo>`         | `md`       |
| Browser tab favicon  | `<LoomIcon>` (SVG file) | 16px    |

## 8. Rules

### Do
- Always pair icon with wordmark except at `xs` / favicon
- Center icon and text vertically
- Warp = `#171717`, Weft = `#0a72ef` — never swap
- Always lowercase `loom`
- Weight is always 600

### Don't
- Don't stretch or distort the icon's aspect ratio (always square)
- Don't use on colored backgrounds without adjusting `--logo-bg`
- Don't add shadows, outlines, or glow effects
- Don't use positive letter-spacing
- Don't reduce font weight below 600

## 9. Files Changed

| File | Change |
|------|--------|
| `packages/web/src/components/ui/loom-icon.tsx` | New — `LoomIcon` and `LoomLogo` components |
| `packages/web/src/App.tsx` | Replace text-only nav logo with `<LoomLogo size="sm" />` |
| `packages/web/src/pages/ProjectsPage.tsx` | Add `<LoomLogo size="lg" />` to empty state if present |
| `packages/web/public/favicon.svg` | New — 16px icon as SVG favicon |
