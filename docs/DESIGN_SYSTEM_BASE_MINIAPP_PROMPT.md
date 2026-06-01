# Cursor prompt: match DeCleanup Network landing design (Base mini app)

Copy everything below the line into Cursor for your **Base / Farcaster mini app** repo. Reference implementation: **Celo dapp** (`decleanup-main-celo` / `dapp.decleanup.net`) and visual source **`DeCleanup-Network/decleanup-landing-standalone`** ([decleanup-network.vercel.app](https://decleanup-network.vercel.app)).

---

## Prompt (copy from here)

You are restyling our Base mini app so it matches the **DeCleanup Network** public landing and the **Celo full dapp** design system. Do **not** rebuild marketing pages section-by-section—apply the **same tokens, typography, buttons, cards, and footer patterns** to our existing mini app screens.

### Source of truth (read these patterns)

1. **Landing (visual reference):** https://github.com/DeCleanup-Network/decleanup-landing-standalone  
   - `stylesheets/styles.css` — `:root` tokens, `.btn-primary`, `.footer-link`, `.plakat`, `.meta`, `.gradient-text`, `.card`
2. **Production landing:** https://decleanup-network.vercel.app  
3. **Celo dapp implementation (already done):** `frontend/src/app/globals.css`, `frontend/src/lib/fonts/landing-fonts.ts`, `frontend/src/components/ui/button.tsx`, pre-login home in `frontend/src/app/page.tsx`

### Brand

- **Network name:** DeCleanup Network  
- **Mini app / product name:** DeCleanup Rewards (or “mini app” in copy)  
- **Tagline (marketing):** Clean Local. Prove Global.  
- **Tone:** Field report / protocol—confident, not playful. Use **onchain** (one word, no hyphen).

### Typography (required—do not use Bebas or generic system UI)

Load via `next/font/google` (or equivalent):

| Role | Font | Usage |
|------|------|--------|
| Display / H1–H6 | **Space Grotesk** 700 | Titles, CTAs label styling (`.font-plakat`) |
| Body | **Inter** 400–600 | Paragraphs, buttons, forms |
| Labels / footer / stats eyebrows | **Space Mono** 400 | Uppercase, `letter-spacing: 0.08–0.12em` (`.font-meta`, `.footer-link`) |

**Display heading style (`.plakat` / `.font-plakat`):**

- `font-weight: 700`
- `letter-spacing: -0.02em`
- `line-height: 0.92`
- `text-transform: uppercase`

**Body lede (`.text-landing-lede`):**

- Inter, `font-weight: 500`
- `font-size: clamp(16px, 1.5vw, 20px)`
- `color: rgba(255, 255, 255, 0.92)`
- `line-height: 1.5`

**Small hint (`.text-landing-hint`):**

- Inter 14px, color `#8B8B89`

### Colors (required)

```css
--background: #0A0A0A;
--bg-elev: #141414;
--bg-elev-2: #1B1B1B;
--foreground: #FFFFFF;
--green: #4ADE80;          /* primary brand — NOT #58B12F */
--yellow: #FAFF00;         /* accent only */
--line: rgba(255, 255, 255, 0.10);
--line-soft: rgba(255, 255, 255, 0.06);
--ink-dim: #8B8B89;
--grad-heading: linear-gradient(92deg, #4ADE80 0%, #A8F050 55%, #FAFF00 100%);
```

- **Primary CTA:** green bg `#4ADE80`, text `#0A0A0A` (black on green)
- **Secondary CTA:** ghost—transparent, `border: 1px solid var(--line)`, Inter semibold 14px (`.landing-ghost-link`)
- **Claim / highlight CTA:** yellow `#FAFF00`, black text
- **Cards:** `#141414` background, `border: 1px solid rgba(255,255,255,0.10)`, `border-radius: 10px`
- **Page ambient:** optional fixed radial gradient top-left, green at ~6% opacity (see Celo `body::before`)

### Gradient title

Apply to accent word in product title (e.g. “DECLEANUP” in “DECLEANUP REWARDS”):

```css
.gradient-text {
  background: var(--grad-heading);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Buttons (required)

Primary (`.btn-primary` / `variant="brand"`):

- `min-height: 48px`, `border-radius: 8px` (or 10px)
- Green fill, black text
- Resting shadow: inset highlight + soft green drop shadow
- Hover: `translateY(-1px)`, green halo ring `0 0 0 4px` green at 14% opacity
- Active: slight press `translateY(2px) scale(0.985)`
- Optional: green particle burst on click (12 dots)—respect `prefers-reduced-motion`

Ghost secondary:

- Border `var(--line)`, hover border brighter + `background: rgba(255,255,255,0.04)`

Mono nav CTA (optional):

- Space Mono, uppercase, `letter-spacing: 0.12em`, 12px

### Components to implement or mirror

1. **`IconAccent`** — Lucide icon in `h-10 w-10` box, `border-white/10`, `bg-elevated`, soft green or yellow ring shadow  
2. **`StatusChip`** — mono pill + 6px dot (green = live pulse, yellow = pilot)  
3. **`.dcu-card`** — standard panel; optional `.dcu-card-glow` animated green border  
4. **`.footer-link`** — Space Mono 12px uppercase, hover green  
5. **Section headings** — `IconAccent` + Space Grotesk title (not plain Lucide + random font)

### Screen checklist (mini app)

Apply the system to **every** screen—do not leave old gray Tailwind defaults:

- [ ] Splash / connect / wallet entry  
- [ ] Home / dashboard after connect  
- [ ] Submit cleanup flow (all steps)  
- [ ] Success / pending / error states  
- [ ] Rewards / balance / claim UI  
- [ ] Settings / profile if any  
- [ ] Modals and toasts  
- [ ] Empty states and loading skeletons (use `#141414` surfaces, not `gray-800`)  
- [ ] Footer or link row (Website, GitHub, X, Farcaster, Telegram, Giveth, Terms, Privacy) with `.footer-link`  
- [ ] “How it works” → ghost button style, not default blue link  

### Copy patterns (pre-login / onboarding)

- Primary: **Log in** or **Start cleaning** (green button)  
- Secondary: **How it works** (ghost button, not underline link)  
- Hint below CTAs (Inter): `Sign in with Google, email, or wallet, then use DeCleanup Rewards.` (adapt if mini app is wallet-only)  
- Optional strip: `Past contributors: check $cDCU airdrop eligibility.` + **Check airdrop** (green)—only if airdrop exists on Base  

### Base-specific notes

- Chain accent for Base: `#0052FF` (tags/chips only—**do not** replace primary green with Base blue for main CTAs)  
- Token symbol on Base: **$bDCU** (Celo full app uses **$cDCU**)  
- Keep mini app layout compact; same tokens and fonts still apply  
- If using Farcaster mini app frame, ensure `theme-color` meta is `#4ADE80` or `#0A0A0A`

### API (optional live stats)

If showing network impact on home:

- `GET https://dapp.decleanup.net/api/impact/global` (CORS `*`)  
- `GET https://dapp.decleanup.net/api/impact/cleanups?limit=12`  
- Show “—” / pilot state when `total_cleanups_verified === 0`

### Do NOT

- Copy landing JSX/HTML wholesale or use Babel-in-browser React from standalone repo  
- Use Bebas Neue, Geist-only, or default shadcn light theme  
- Use old green `#58B12F` as primary  
- Use underlined `text-muted-foreground` links for primary secondary actions  
- Forget footer mono links or Inter body on helper text  

### Acceptance criteria

1. Side-by-side with https://decleanup-network.vercel.app — fonts and colors feel like the same brand  
2. Primary buttons are `#4ADE80` with black text and hover glow  
3. All headings Space Grotesk bold uppercase; all footer links Space Mono uppercase  
4. Cards are `#141414` with subtle white borders, not heavy gray-900 rounded-2xl  
5. No screen still uses pre-refactor typography  

### Deliverables

1. Central `globals.css` (or theme file) with all tokens and utility classes above  
2. Font loader module (Space Grotesk, Inter, Space Mono)  
3. Updated `Button` variants: `brand`, `brandYellow`, `brandGhost`  
4. Short `DESIGN.md` in repo listing tokens and class names for future edits  

Work incrementally: tokens + fonts first, then Button, then home, then cleanup flow, then modals/footer. Run build after each phase.

---

## End of prompt

### Quick links for humans

| Resource | URL |
|----------|-----|
| Landing live | https://decleanup-network.vercel.app |
| Landing repo | https://github.com/DeCleanup-Network/decleanup-landing-standalone |
| Celo dapp | https://dapp.decleanup.net |
| Public impact API | `docs/PUBLIC_IMPACT_API.md` in main celo repo |
