# Traceback v2 design system

The interface supports a repeated loop: define a user journey, run it, inspect browser evidence, and make a decision. Existing test, suite, run, issue, event, workspace, and personal-project routes remain available.

The later design-system asset in traceback-operator supersedes its older sharp-corner IBM Plex mockups. V2 retains the later warm palette and Instrument Sans / Geist / Geist Mono hierarchy. It applies the new research to navigation, controls, browser frames, and all loading, empty, unavailable, and missing-record states.

| Reference researched | Observation | Traceback decision |
| --- | --- | --- |
| [Linear’s UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) | Align global chrome, headers, tabs, and panels; stress-test different view types. | Stable navigation, consistent page and view headers, compact evidence rows, desktop and mobile route tests. |
| [Notion sidebar guidance](https://www.notion.com/help/navigate-with-the-sidebar) | Workspace hierarchy and nested views keep context visible. | Project navigation persists into definition and run details; editing stays in the relevant view. |
| [Apple’s Aqua introduction, January 2000](https://www.apple.com/newsroom/2000/01/05Apple-Unveils-Mac-OS-X/) | Aqua established a recognizable visual language for controls and application organization. | An interpreted, restrained reference: inset button highlights, warm control gradients, segmented controls, and a contained browser frame. This is not a copy of Aqua assets. |

## Tokens and behavior

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | #f8f7f2 | #111110 |
| Subtle surface | #f2f1ea | #1a1a18 |
| Primary text | #18180f | #f0efe8 |
| Secondary text | #5a5a4f | #a8a89c |
| Accent | #5b8def | #7aaeff |

Status chips contain text and use restrained green, red, blue, or amber treatments. Blocked, cancelled, and paused runs are distinct from passing and failing checks. Active status is never inferred from a decorative animation.

Headings use Instrument Sans, body and UI use Geist Sans, and technical values use Geist Mono. Spacing follows a 4px base: 8, 12, 16, 24, 32, 48. Data chips have 2px corners, controls 4px, contained browser frames 8px. Product motion is limited to immediate press feedback and short contextual transitions; reduced-motion preferences are respected.

The editor uses a dominant main column and a 280px settings rail. Below 760px it becomes one column. The live run uses steps / browser / action log; it collapses progressively at 1100px and 760px. Mobile navigation retains access to all primary workspace and project sections. Focus outlines remain visible, form labels are programmatic, and status text accompanies color.

The `/design-system` route is a live reference built from the same tokens and controls as the product. Implementations live in `client/src/index.css` and the V2 pages.

## Requested implementation filters and Operator source

Anti-slop, revision `388cbe3b6c37d5175b9f460015bb092ef9e34894`, was read as an implementation filter for the new journey surfaces and code comments. It is not installed globally and no agent entry file was modified. The source direction and dials are recorded in DESIGN.md. New screens use actual definitions and evidence, with synthetic and draft provenance stated explicitly.

OpenIntelligentUI, revision `f6e4388b26a64b9a0714943b08a1ce622b924eec`, supplies the vendored theme/form/SVG design system and the MCP document-assembly pattern for Operator artifacts. Its MIT license is included next to the source. The adapter replaces direct host HTML injection with a sandboxed iframe, forbids network access and same-origin storage, validates message sources, bounds resize requests, follows the host theme, and requires host interaction before sending follow-ups or opening external links. This integration retains Traceback's existing chat transport; it does not claim to run the upstream Python/Next.js agent stack.
