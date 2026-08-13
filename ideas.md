# Braille Read — Design Direction

## Three Directions Considered

### Theme Name: Quiet Signal
Very brief intro: A calm, editorial accessibility tool that uses warm paper tones, ink-blue structure, and one luminous signal color to make complex reading data feel safe and legible.
Probability: 0.07

### Theme Name: Field Notes
Very brief intro: A tactile classroom instrument inspired by annotated workbooks, measurement marks, and teacher observation sheets, balancing human warmth with clear data views.
Probability: 0.04

### Theme Name: Signal Garden
Very brief intro: A dark, high-contrast monitoring surface with electric accents and live motion traces for a more technical, laboratory-like feel.
Probability: 0.02

## Chosen Direction: Quiet Signal

### Design Movement
Contemporary editorial accessibility design with references to Swiss information design, tactile paper, and quiet medical instrumentation.

### Core Principles
1. Make every state understandable at a glance through strong hierarchy, plain language, and visible status labels.
2. Pair tactile warmth with analytical precision: soft paper surfaces and ink-like typography alongside measured traces and compact metrics.
3. Use asymmetry and a persistent left rail to create orientation without overwhelming the student or teacher.
4. Treat accessibility as a visual and interaction quality: high contrast, generous targets, keyboard reachability, reduced-motion support, and never relying on color alone.

### Color Philosophy
The base is warm parchment rather than stark white, reducing glare and creating a classroom-notebook atmosphere. Deep ink blue anchors trust and legibility. A single ownable signal color, optic chartreuse, marks live tracking and actionable moments without turning the interface into a warning system. Coral is reserved for missed regions or support needs, always paired with labels and icons.

### Layout Paradigm
A persistent narrow navigation rail establishes place, while the main content behaves like a teacher's annotated desk: one strong headline, an asymmetric metric band, and layered cards that feel placed rather than tiled. Student mode collapses the rail into a focused single-column stage.

### Signature Elements
- A small six-dot Braille mark used as the brand symbol and as a repeated visual punctuation.
- Thin measurement rules and dotted baselines that echo a finger path across a Braille line.
- Signal chips that combine icon, label, and state instead of color-only indicators.

### Interaction Philosophy
Interactions should feel reassuring and explicit. Primary actions name their consequence, progress is always visible, and live tracking uses short plain-language updates. Hover and focus states reveal context without moving the user's reading position.

### Animation
Use short, low-amplitude transitions with a snappy ease-out. Live reading traces drift horizontally rather than bounce. New insight cards enter with a subtle opacity and 8px translate. Respect prefers-reduced-motion and replace motion with clear state changes.

### Typography System
Use Fraunces for display headlines and section numerals, paired with Atkinson Hyperlegible for body copy and controls. Headlines are compact, slightly expressive, and never all caps. Body text stays 16px or larger in core flows with 1.55 line height. Metric numbers use tabular numerals.

### Brand Essence
Braille Read helps educators see the reading behaviors behind a student's progress, so support can become specific instead of assumed. Personality: observant, steady, empowering.

### Brand Voice
Headlines are human and direct. CTAs describe the next step, never generic conversion language. Microcopy is calm, specific, and non-judgmental.
Example lines: “See where reading gets harder.” / “Start a guided reading check.”

### Wordmark & Logo
The mark is a compact six-dot Braille cell with one chartreuse dot offset into a signal pulse. The wordmark is set in a custom-feeling serif/sans pairing rather than a default UI font, with “read” slightly lighter to suggest motion.

### Signature Brand Color
Signal chartreuse: #C7F36A — bright enough to read as a live cue on ink blue, warm enough to feel optimistic rather than alarm-driven.

## Product Notes
This first delivery is a frontend-only prototype. Camera and speech analysis are represented with a believable demo mode and clearly labeled simulated states, so a hackathon judge can understand the intended experience without mistaking it for validated clinical measurement. Scientific reading-speed ranges should be connected to an evidence-reviewed source and age/grade configuration before real deployment.
