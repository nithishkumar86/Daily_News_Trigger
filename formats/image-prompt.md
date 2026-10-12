# Image prompt format — one infographic prompt per newsletter section / article

You write image generation prompts for AI Digital Tamizha. Another agent (Codex) will
paste each prompt into an image model exactly as written, so every prompt must be
complete and self-contained: it must describe the whole image and contain every word
of text that should appear in it. Never refer to "the article", "above" or "the
newsletter" — the image model cannot see them.

Base every prompt ONLY on the content you just wrote for that section. Copy headlines
and sentences into the prompt word for word (shortened where noted below) so the image
and the text match exactly. Never invent companies, products, figures or dates.

---

## Which prompts to write

Newsletter → exactly 4 prompts, one per picked section:

| section_key | title (big headline in the image)  | built from section                |
|-------------|------------------------------------|-----------------------------------|
| world       | TOP 5 AI NEWS OF THE WORLD         | 1. AI World of this news          |
| tools       | TOP 5 AI TOOL UPDATES              | 2. AI tools update of the week    |
| insights    | TOP 5 AI INSIGHTS                  | 3. AI Insights                    |
| trending    | AI TRENDING TOOL OF THE WEEK       | 4. AI Trending Tool of the week   |

If a section has fewer than 5 stories, use "TOP N" with the real count (e.g. TOP 3
AI INSIGHTS) and that many columns.

Article → exactly 1 prompt with section_key `hero` and the article's H1 headline as the title.

---

## Layout A — "Top 5" sections (world, tools, insights)

Write the prompt in this structure, filling every bracket:

```
A wide 16:9 landscape infographic (1536x1024), ultra detailed, crisp readable text,
premium tech poster style. Deep navy to black background with subtle glowing circuit
lines, a glowing neon AI brain icon in the top left corner and a glowing circular
"[YEAR]" badge with small rising bar chart in the top right corner.

Top center: huge bold headline "[TITLE]" — the words "TOP 5" in white, the rest in a
bright cyan to blue gradient with soft glow. Below it one line of smaller white text:
"[ONE LINE SUBTITLE summarising the section, max 14 words]".

Below, five tall rounded glass cards side by side, each with a thin neon border in its
own colour — card 1 teal, card 2 purple, card 3 green, card 4 blue, card 5 orange.
Each card contains, top to bottom:
- a large circled number (1 to 5) in the card colour next to the bold headline in the card colour
- the company or product name as a clean white wordmark with a simple logo-style icon
- a small glowing UI mockup illustration that shows the story (describe it: e.g. a project dashboard, a code editor with tests passing, an agent workflow diagram)
- two short white paragraphs (the summary, max 45 words total)
- an icon in a circle plus the label "WHY IT MATTERS:" in the card colour and one or two lines of white text
- an icon in a circle plus the label "BEST USE CASE:" in the card colour and one line of white text

Card 1 — headline "[HEADLINE 1]", wordmark "[COMPANY 1]", mockup: [MOCKUP 1],
text: "[SUMMARY 1]", why it matters: "[WHY 1]", best use case: "[USE 1]".
Card 2 — ...  (repeat for all cards)

Bottom: a full width dark strip with five evenly spaced items, each a coloured glowing
icon plus short white text: "[SLOGAN 1]" | "[SLOGAN 2]" | "[SLOGAN 3]" | "[SLOGAN 4]" | "[SLOGAN 5]".

Style: futuristic, clean, high contrast, neon glow, sharp typography, no spelling
mistakes, all text in English, no watermark, no people's faces.
```

Rules for Layout A:
- For `insights` and `world`, replace "BEST USE CASE:" with "WHAT IT MEANS:" (insights) or keep only
  "WHY IT MATTERS:" (world) to match the section's own fields.
- Slogans are 2 to 5 words each, upbeat, summarising the section (e.g. "Smarter tools.",
  "Stronger agents.", "Bigger impact.", "Built for the future.", "Work less. Achieve more with AI.").
- Keep every text snippet short — image models garble long text. Summary max 45 words,
  why/use lines max 25 words each.

---

## Layout B — trending tool (trending)

```
A wide 16:9 landscape infographic (1536x1024), ultra detailed, crisp readable text,
premium tech poster style, same deep navy neon look as above.

Top center: huge bold headline "AI TRENDING TOOL OF THE WEEK" with "TRENDING" in a
cyan to purple gradient. Below: "[TOOL NAME]" as a large glowing white wordmark with a
logo-style icon.

Left half: a large glowing UI mockup of the tool in action ([DESCRIBE MOCKUP]) and
below it a short paragraph: "[WHAT IT IS, max 40 words]".

Right half: a glass panel titled "WHY IT IS TRENDING" with two short lines
"[POINT 1]" and "[POINT 2]", then a panel titled "BEST USE CASES" with five rows, each
a coloured icon plus label and one short line:
Students — "[...]", Freelancers — "[...]", Working professionals — "[...]",
Business owners — "[...]", Real estate — "[...]".

Bottom strip: "Learn AI. Apply AI. Grow with AI." centered in glowing white text.

Style: futuristic, clean, high contrast, neon glow, sharp typography, no spelling
mistakes, all text in English, no watermark, no people's faces.
```

---

## Layout C — article hero (hero)

```
A wide 16:9 landscape infographic (1536x1024), same deep navy neon tech poster style.
Top: the headline "[ARTICLE H1]" in bold white with a cyan gradient on the key words.
Center left: a large glowing illustration of the story's subject ([DESCRIBE]).
Center right: an "AI METER" glass panel with three horizontal glowing bars and labels:
"Performance [X]%", "Accuracy [Y]%", "Ease of Use [Z]%", and below it "VERDICT: [VERDICT LINE]".
Bottom: five round glowing icons in a row with labels "Students", "Freelancers",
"Working Professionals", "Business Owners", "Real Estate Agents".
Footer text: "aidigitaltamizha.com".
Style: futuristic, clean, high contrast, sharp typography, all text in English, no watermark.
```

Use the exact AI METER numbers and verdict from the article you wrote.

---

## Output shape

Return each prompt as an object `{ "section_key": "...", "title": "...", "prompt": "..." }`.
The `prompt` is the filled-in text block only (no markdown fences), max 6000 characters.
