# Design Context: Runner List Application

## 1. Aesthetic Analysis
**Visual Style:** Premium Dark Mode with Glassmorphism
**Primary Inspiration:** Cyberpunk / Modern SaaS Dashboard

### Color Palette
- **Background:** 
  - Base: `#0b0c15` (Deep Blue/Black)
  - Gradient: Radial from Slate-900 to `#0b0c15`
- **Surface (Glass):**
  - Background: `rgba(30, 41, 59, 0.6)` (Slate-800 with opacity)
  - Border: `rgba(255, 255, 255, 0.08)`
  - Blur: `12px`
- **Typography:**
  - Headings: Sans-serif (Geist Sans inferred), Bold, Gradient text (Indigo to Purple)
  - Body: Slate-300 / Slate-400
- **Accents:**
  - Primary: Indigo (`#6366f1` -> `#4f46e5`)
  - Success: Emerald (`#10b981`)
  - Warning/ASAP: Red (`#ef4444`)
  - Info: Blue (`#3b82f6`)

### Common UI Patterns
- **Cards:** "Glass Panels" with borders, background blur, and hover glow effects.
- **Buttons:**
  - Primary: Indigo background, shadow-lg, rounded-lg.
  - Secondary/Action: Slate-800, border-slate-700, hover:text-white.
  - Ghost: Transparent/Icon buttons.
- **Badges:** Pill-shaped, semi-transparent background (`bg-color/20`), colored text, thin border.
- **Inputs:** Dark background (`#0b0c15`), border-slate-700, focus ring (Emerald/Indigo).

## 2. Modernization Opportunities (Component Library)

The current application relies heavily on inline Tailwind utility classes in `page.tsx` and global CSS classes. To modernize, we should extract these into a reusable, typed React component library (`src/components/ui`).

### Proposed Components
1.  **Card**: Standardize the "glass-panel" logic.
2.  **Button**: Variants for `primary`, `secondary`, `danger`, `ghost`.
3.  **Badge**: Standardize status pills (Pending, Assigned, etc.).
4.  **Input**: Reusable styled input with icons.
5.  **Modal**: Refine existing `Modal.tsx` to match the new design system perfectly.
6.  **PageHeader**: Standardize the gradient text and action bar.

### CSS Enhancements
- Switch to semantic CSS variables (e.g., `--card-bg`, `--primary-btn-bg`) for easier theming.
- Add smoother interactions (micro-animations on hover/active).
