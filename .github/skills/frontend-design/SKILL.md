---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the product context and commit to a clear visual direction.

- **Purpose**: What problem does the interface solve and what action should feel easiest?
- **Audience**: Who uses it, what do they already know, and how much density can they tolerate?
- **Tone**: Pick a concrete design posture such as editorial, industrial, playful, luxury, brutalist, retro-futurist, organic, or rigorously minimal.
- **Constraints**: Respect framework, responsiveness, accessibility, performance, and release constraints from the start.
- **Differentiation**: Define the one memorable visual or interaction idea that gives the interface character.

Choose a clear concept and execute it with discipline. Bold maximalism and refined minimalism both work when every choice supports the same point of view.

## Production Requirements

Everything produced with this skill must be production-grade.

- Ship real working code, not mockups disguised as implementation.
- Ensure the result works on desktop and mobile unless the user explicitly scopes it more narrowly.
- Include sensible empty, loading, error, hover, focus, and disabled states where relevant.
- Use semantic HTML and accessible names, labels, keyboard behavior, and focus management.
- Respect contrast requirements and avoid text that becomes unreadable over decorative backgrounds.
- Use CSS variables or another clear token system for repeated colors, spacing, radii, and typography decisions.
- Avoid layout shift from late-loading fonts, images, or animations.
- Do not depend on broken placeholder assets or remote resources that are likely to fail in production.

## Typography

- Prefer expressive, intentional font pairings over generic defaults.
- Avoid overused safe stacks such as Inter, Roboto, Arial, and raw system stacks unless the existing design system already uses them.
- Pair display and body faces deliberately, and provide robust fallbacks.
- Treat spacing, line length, weight, and hierarchy as first-class design tools.

## Color And Surface

- Commit to a cohesive palette with a clear hierarchy of dominant tones, accents, and neutrals.
- Use backgrounds, gradients, textures, transparency, borders, and shadow language to create atmosphere.
- Avoid clichéd purple-on-white startup gradients and generic dashboard palettes.
- Decorative effects should reinforce the concept, not bury the content.

## Motion And Reduced Motion

- Motion should clarify structure, state changes, or emotional tone.
- Prefer a few strong transitions over constant low-value animation.
- Respect `prefers-reduced-motion` and provide calmer fallbacks for major transforms, parallax, autoplay, and stagger effects.
- Treat motion as optional polish, not as a requirement for the UI to make sense.

## Composition And Detail

- Use asymmetry, rhythm, density, overlap, or restraint intentionally.
- Build depth with layering, scale shifts, framing devices, and visual anchors.
- Avoid cookie-cutter layout patterns unless the project already enforces them.
- Micro-details matter: states, spacing, icon sizing, alignment, and copy tone should all feel considered.

## Complexity Guidance

Match implementation complexity to the idea.

- Minimal designs need precision, restraint, and disciplined spacing.
- Rich designs may use stronger visual systems, but should still stay maintainable and purposeful.
- More animation, more effects, and more code do not automatically produce better design.

## Security And Release Guardrails

- Do not introduce unsafe HTML injection or unreviewed remote script dependencies just to achieve an effect.
- Prefer robust local assets and framework-native patterns.
- Keep code understandable enough for another engineer to maintain after release.
- When working inside an existing design system or product, preserve that system unless the user explicitly asks for a new direction.

Never default to generic AI-looking aesthetics. Each result should feel designed for its specific context, audience, and product goals.
