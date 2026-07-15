---
version: alpha
name: Atlas
description: A focused design system for fast, human-centered creative talent discovery.

colors:
  background: "#F8F7FB"
  foreground: "#252338"
  surface: "#FFFFFF"
  surface-muted: "#F2F1F7"
  primary: "#0066CC"
  on-primary: "#FFFFFF"
  secondary: "#E5F0FB"
  on-secondary: "#004C99"
  accent: "#0066CC"
  on-accent: "#FFFFFF"
  border: "#E2DFEA"
  input: "#D1CCD9"
  success: "#167A52"
  on-success: "#FFFFFF"
  warning: "#A96108"
  on-warning: "#FFFFFF"
  error: "#C93449"
  on-error: "#FFFFFF"
  info: "#3566C8"
  on-info: "#FFFFFF"
  brand-lime: "#DFFF62"
  brand-lavender: "#CFA6E8"

typography:
  display:
    fontFamily: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 2.25rem
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.04em
  heading-1:
    fontFamily: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1.875rem
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.035em
  heading-2:
    fontFamily: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.02em
  heading-3:
    fontFamily: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.5

rounded:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px

spacing:
  1: 0.25rem
  2: 0.5rem
  3: 0.75rem
  4: 1rem
  5: 1.25rem
  6: 1.5rem
  8: 2rem
  10: 2.5rem
  12: 3rem
  16: 4rem

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3} {spacing.4}"
    height: 2.25rem
  button-primary-hover:
    backgroundColor: "#3385D6"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3} {spacing.4}"
    height: 2.25rem
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3} {spacing.4}"
    height: 2.25rem
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3} {spacing.4}"
    height: 2.25rem
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3} {spacing.4}"
    height: 2.25rem
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3} {spacing.4}"
    height: 2.25rem
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.2} {spacing.3}"
    height: 2rem
  textarea:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.4}"
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.1} {spacing.2}"
    height: 1.25rem
  match-score:
    backgroundColor: "{colors.brand-lime}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.1} {spacing.2}"
    height: 1.5rem
  avatar:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    size: 2.5rem
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.2} {spacing.3}"
    height: 2.5rem
  nav-item-active:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.2} {spacing.3}"
    height: 2.5rem
---

# Atlas Design System

## Overview

Atlas is a talent discovery workspace for hirers and creative talent. The visual system is calm and compact so people can scan profiles, compare evidence, and act without losing context. Blue makes intent obvious, lime marks meaningful match moments, and lavender adds warmth to supporting surfaces. Avoid noisy dashboards, decorative gradients, and one-off controls that make the product feel less trustworthy.

## Colors

The palette is built around a soft near-white canvas, near-black ink, and a blue action colour with strong contrast. `primary` is used for conversion, navigation, links, and focus; `brand-lime` is deliberately scarce and should mean match confidence, recommendation, or a positive decision. `secondary` and `brand-lavender` create grouped surfaces without competing with the primary action. Text and interactive combinations should meet WCAG AA; the dark theme counterparts live in `src/app/globals.css` and keep the same semantic roles.

## Typography

The system uses a system sans stack for a neutral, immediate voice and a monospace token for technical labels and values. `display` and `heading-1` are tight and confident; `heading-2` and `heading-3` create clear scan points inside cards; `body` prioritises a generous line height for profile summaries; `label` is for controls and metadata. Keep hierarchy in weight and spacing before adding colour.

## Layout

Spacing follows a 4px base with named steps from `spacing.1` through `spacing.16`. Use 16px as the default card inset, 24px to separate related groups, and 32–48px to separate sections. Work surfaces should stay within a readable max width and use a single main column or a clear two-column split; do not create dense grids that turn people into undifferentiated tiles.

## Elevation & Depth

Atlas is border-first. Cards use a quiet border and a restrained shadow only when they need to lift above a page, such as a dialog or floating action. Avoid heavy shadows and nested surfaces with competing elevation. Focus states use the blue ring so keyboard users receive the same hierarchy as pointer users.

## Shapes

Controls use `rounded.sm` (8px), cards use `rounded.md` (12px), larger grouped surfaces may use `rounded.lg` (16px), and tags or avatars use `rounded.full`. The shape language is soft but not playful: full rounding is reserved for compact tokens and identity elements, not for every container.

## Components

The reusable interaction layer lives in `src/components/ui` and is configured with `components.json` using the shadcn `base-nova` style and Lucide icons. Use `Button` variants for actions, `Input` and `Textarea` for fields, `Card` for grouped content, `Badge` for short metadata, `Avatar` for identity, `Dialog` for focused tasks, and `Separator` for quiet grouping. Every interactive component needs a visible focus state, a disabled state, and a clear text label or accessible name. Match scores should use `match-score`, never a generic success badge, because the lime colour carries product meaning. Motion follows the CRISP tokens in `src/app/globals.css`: 150ms for presses, tooltips, and small popovers; 300ms for modals, drawers, and standard transitions; 500ms for marketing or explanatory motion — entering elements ease out (`cubic-bezier(0.16, 1, 0.3, 1)`), on-screen morphs ease in-out, and reduced-motion preferences remove transform-based movement while keeping comprehension-aiding fades.

## Do's and Don'ts

Do use semantic tokens such as `bg-primary` and `text-muted-foreground`. Do prefer shadcn primitives over bespoke controls. Do keep primary actions visible and copy concise. Do use lime only for match confidence or a similarly meaningful signal. Do let spacing create hierarchy before adding borders or colour.

Don't introduce a new colour for a one-off card. Don't mix oversized marketing treatments into compact work surfaces. Don't use low-contrast muted text for required instructions. Don't hide the main action behind hover-only behaviour. Don't turn every container into a pill or a floating shadow.
