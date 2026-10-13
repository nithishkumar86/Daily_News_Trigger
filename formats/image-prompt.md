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

| section_key | title (big headline in the image)  | built from newsletter section     |
|-------------|------------------------------------|-----------------------------------|
| world       | TOP 5 AI WORLD NEWS                | Top N AI World News               |
| tools       | TOP 5 AI TOOL UPDATES              | Top N AI Tool Updates             |
| insights    | TOP 5 AI INSIGHTS                  | Top N AI Insights                 |
| trending    | AI TRENDING TOOL OF THE WEEK       | AI Trending Tool of the Week      |

The title is the section heading you wrote in the newsletter, in capitals, with the
same real count: "Top 3 AI Insights" becomes TOP 3 AI INSIGHTS with 3 columns. If the
section has one item, use the single heading (AI WORLD NEWS, AI TOOL UPDATE, AI INSIGHT),
never "TOP 1".

Article → exactly 1 prompt with section_key `hero`: a cover image for the one AI tool the
article is about (Layout C), titled "UNKNOWN FACTS OF <COMPANY> <TOOL>".

---

## Layout A — "Top 5" sections (world, tools, insights)

All three Top 5 images (World News, Tool Updates, Insights) use this same structure.
Goal: the image must stand on its own, and must stay readable on a phone screen, so each
column carries only its headline and a clear "why it matters" explanation, never a body
paragraph. A person who never opens the newsletter should understand why every story
matters just by reading the image. So the image is: the section heading, one line saying
what the reader will learn, then the section split into vertical columns, one per story,
each with the story's headline and its "why it matters" explanation in large, readable text.
Only the trending tool image (Layout B) shows the five audience use cases.

Write the prompt in this structure, filling every bracket:

```
A wide 16:9 landscape infographic (1536x1024), ultra detailed, crisp readable text,
premium tech poster style. Deep navy to black background with subtle glowing circuit
lines, a glowing neon AI brain icon in the top left corner and [TOP RIGHT ART] in the
top right corner.

Top center: huge bold headline "[TITLE]", the words "TOP [N]" in white and the rest in a
[TITLE GRADIENT] gradient with soft glow. Directly below it, one line of white text:
"[INTRO LINE: what the reader will learn from this section, max 14 words]", with the
year in the same colour as the title.

Below, the image is split into [N] tall vertical rounded glass columns side by side, equal
width, each with a thin neon border in its own colour: [COLUMN COLOURS].
Each column contains, top to bottom:
- a large circled number in the column colour next to the story headline in bold capitals, white with its key words in the column colour
- the company or product name as a clean white wordmark with a simple logo style icon
- a small glowing illustration that shows the story (describe it: e.g. a project dashboard, a code editor with agent task cards ticked, a cloud data centre, a goal to context to tools to review workflow loop)
- an icon in a circle plus the label "[LABEL A]" in the column colour, then its explanation
  broken into short line wrapped sentences (about 3 to 5 words per line, never one long
  unbroken line), set in a bold, highly legible sans serif, solid white on the dark glass
  panel with clear padding around it — this is the column's only explanation and the
  single most important text in the whole image, so make it the largest body text in the
  column, large enough to read at a glance on a phone screen held at arm's length, not
  just readable when zoomed in on a desktop monitor
- an icon in a circle plus the label "[LABEL B]" in the column colour and one or two short
  line wrapped lines of white text, smaller than [LABEL A]'s text but still clearly legible
  on a phone screen

Column 1: headline "[HEADLINE 1]", wordmark "[COMPANY 1]", illustration: [ILLUSTRATION 1],
[LABEL A]: "[TEXT 1A]", [LABEL B]: "[TEXT 1B]".
Column 2: ...  (repeat for every column)

Bottom: a full width dark strip with five evenly spaced items separated by thin lines,
each a coloured glowing icon plus short white text: "[SLOGAN 1]" | "[SLOGAN 2]" |
"[SLOGAN 3]" | "[SLOGAN 4]" | "[SLOGAN 5]".

Style: futuristic, clean, high contrast, neon glow, sharp bold typography. Every piece of
text, especially each column's "why it matters" / "what it means" explanation, must be
large, bold and high contrast enough to read clearly both zoomed in on a desktop monitor
and at a glance on a small phone screen: no thin decorative fonts, no tiny text, no text
that only works at one size. No spelling mistakes, all text in English, no watermark. Any
people are stylised digital illustrations, never real or recognisable people.
```

Per section look (from the manager's reference images):

| section_key | TITLE GRADIENT        | COLUMN COLOURS (1 to 5)                    | TOP RIGHT ART                                   | bottom strip |
|-------------|-----------------------|--------------------------------------------|-------------------------------------------------|--------------|
| tools       | bright cyan to blue   | teal, purple, green, blue, orange          | a glowing circular "[YEAR]" badge with a small rising bar chart | five icon + slogan items |
| insights    | gold to bright yellow | blue, orange, green, purple, sky blue      | a glowing rising arrow over a neon bar chart    | first item is a gold trophy with the first slogan in gold; the last slogan has "AI Dominators" in gold |
| world       | bright cyan to teal   | teal, purple, green, blue, orange          | a glowing neon globe with orbit lines and the "[YEAR]" in it | five icon + slogan items |

[YEAR] is the year of the newest item Date in the job, never a guessed year.

What goes in each column (copy word for word from the entry you wrote, never rewrite):
- Headline: the entry's numbered headline, without the number.
- [LABEL A] text is the column's only explanation (the entry's body paragraphs are never
  shown in the image), so it must be the entry's own "Why it matters" / "What it means"
  line, copied word for word, written as a clear, complete sentence a reader can understand
  without ever opening the newsletter.
- The two labelled boxes depend on the section, and only use fields the entry really has:

| section_key | LABEL A           | LABEL B                                              |
|-------------|-------------------|------------------------------------------------------|
| tools       | WHY IT MATTERS:   | BEST USE CASE:                                       |
| world       | WHY IT MATTERS:   | (none: leave the second box out)                     |
| insights    | WHAT IT MEANS:    | AI DOMINATORS TAKEAWAY: or EXAMPLE: (whichever the entry used; leave out if neither) |

- Wordmark: only companies or products named in the entry (an insight may show two or
  three, with an amount under each if the entry gives one, e.g. "$1.5B"). If the entry
  names no company, leave the wordmark out and describe a simple illustration of the trend
  instead. Never draw an invented logo or number.

Rules for Layout A:
- [N] is the real number of stories. Use exactly [N] columns with the first [N] colours in
  the order above. For one story, one wide column.
- The intro line and the slogans are the only text you write fresh. Both follow the
  newsletter writing rules: plain English, no emojis, no hyphens or dashes (product names
  like GPT-5.6 keep their spelling), no asterisks, no hype words.
- Slogans are 2 to 6 words each, upbeat, summarising the section (e.g. tools: "Smarter
  tools.", "Stronger agents.", "Bigger impact.", "Built for the future.", "Work less.
  Achieve more with AI."; insights: "AI is evolving fast. Skills last forever.", "Design
  better workflows", "Leverage the right tools", "Verify everything", "That's how real AI
  Dominators win.").
- Keep every text snippet short, because image models garble long text and crowd small
  phone screens: headline max 8 words, [LABEL A] max 22 words (it is the column's only
  explanation and the image's most important text, so it must stay short enough to render
  at large size and still be a complete, clear sentence), [LABEL B] max 16 words.
- Mobile legibility is mandatory for every column, not optional polish: with up to 5
  columns side by side, each column is narrow, so [LABEL A] and [LABEL B] text must be
  described as bold, high contrast, short line wrapped text that stays sharp at a small
  phone width, never a dense paragraph that only works zoomed in on a desktop screen. If a
  sentence feels long, shorten it rather than letting the image model shrink the font to
  fit.

Style reference (columns built from the manager's real images; match their shape and
length, never copy their facts):

```
Tools column 1: headline "GPT-5.6 and ChatGPT Work", wordmark "OpenAI | ChatGPT WORK",
illustration: a glowing project roadmap dashboard with Research, Analysis, Strategy and
Execution steps, WHY IT MATTERS: "ChatGPT is moving beyond individual conversations. It is
becoming a workspace where AI can analyse information, create deliverables and support
longer projects.", BEST USE CASE: "Reports, business planning, coding, data analysis,
campaign creation and multi step project execution."

Insights column 2: headline "INFRASTRUCTURE BECAME THE FUNDING WINNER" with "FUNDING
WINNER" in orange, wordmarks "baseten $1.5B | SambaNova $1B | supabase $500M",
illustration: a glowing cloud above rows of neon server racks, WHAT IT MEANS: "The hidden
winners of the AI boom may be the companies providing computing, databases, deployment
systems, energy and data centre capacity.", AI DOMINATORS TAKEAWAY: "Cloud AI, data engineering, automation and AI
deployment are strong career and business opportunities."
```

---

## Layout B — trending tool (trending)

This is the only image with the five audience use cases. Keep this layout calm and
uncluttered: a short info panel at the top, then one clean full width row per audience, no
UI mockups, no tab bars, no tick lists, no multi step flow diagrams. Every section must
stay readable both filling a desktop screen and shrunk to a phone width, so prefer fewer,
larger elements over many small ones. Write the prompt in this structure, filling every
bracket:

```
A wide 16:9 landscape infographic (1536x1024), ultra detailed, crisp readable text,
premium tech poster style, calm and uncluttered with generous spacing, not crowded. Deep
navy to black background with subtle glowing circuit lines.

Top left: a glowing circular neon badge with a small rising arrow and the words
"TRENDING NOW". Top center: huge bold headline "AI TRENDING TOOL" in white with "TOOL" in
a cyan to teal gradient, and below it "OF THE WEEK" in widely spaced white capitals between
two thin glowing lines. Top right: a rounded neon bordered badge with a star icon and two
lines: "[EDITION LABEL]" in white and "[EDITION DATES]" in teal.

Below the header, one wide glass panel spanning the full width:
- left side: a large rounded app icon tile for the tool, next to the tool name
  "[TOOL NAME]" as a huge two tone wordmark (first word white, second word teal), and under
  it a teal pill with "[WITH MODEL]"
- center: one or two lines of large white text: "[DESCRIPTION, max 20 words]", and below it
  three short feature tags in a single row, each a small pill with an icon and 2 or 3 words:
  "[FEATURE 1]" "[FEATURE 2]" "[FEATURE 3]"
- right side: the heading "WHY THIS TOOL IS TRENDING" in gold and one short line of white text,
  "[TRENDING LINE]", max 16 words

Next, a slim gold bordered strip across the full width: a trophy icon, the label
"AI DOMINATORS TAKEAWAY" in gold, followed by one short white sentence, "[TAKEAWAY LINE]",
max 18 words.

Below that, the heading "BEST USE CASES" centered between two thin glowing lines, then
exactly five full width horizontal rows stacked top to bottom, equal height, each clearly
separated by a thin divider line so they read as a simple clean list, not cards. Every row
has the same layout, left to right: a round neon icon in the row's colour, a short bold
label in that colour ("FOR STUDENTS", "FOR FREELANCERS", "FOR WORKING PROFESSIONALS",
"FOR BUSINESS OWNERS", "FOR REAL ESTATE PROFESSIONALS"), then one single line of bold
white text with that audience's use case sentence filling the rest of the row. No side
illustrations, no people, no tick lists, no extra icons in the rows, just the icon, the
label and the one line sentence, so each row stays simple and reads instantly on a phone.
1. purple icon, "FOR STUDENTS": "[STUDENTS SENTENCE]"
2. blue icon, "FOR FREELANCERS": "[FREELANCERS SENTENCE]"
3. green icon, "FOR WORKING PROFESSIONALS": "[PROFESSIONALS SENTENCE]"
4. orange icon, "FOR BUSINESS OWNERS": "[BUSINESS OWNERS SENTENCE]"
5. teal icon, "FOR REAL ESTATE PROFESSIONALS": "[REAL ESTATE SENTENCE]"

Bottom: a full width dark strip with four items separated by thin lines, each a coloured
glowing icon and one short white line: "[SLOGAN 1]" | "[SLOGAN 2]" | "[SLOGAN 3]" |
"[SLOGAN 4]", and on the far right a rounded neon bordered pill with "[CLOSING LINE]
THAT'S HOW AI DOMINATORS WIN." with "AI DOMINATORS" in teal.

Style: futuristic, clean, minimal, high contrast, neon glow, sharp bold typography, calm
and uncluttered with clear breathing room between sections, body text large enough to
read clearly both on a desktop screen and at a glance on a phone screen, no tiny text, no
spelling mistakes, all text in English, no watermark. No decorative illustrations beyond
the icons named above, no people.
```

What goes where (everything comes from the trending tool section you wrote):
- [TOOL NAME] and [WITH MODEL]: from the tool heading, e.g. "ChatGPT Work With GPT-5.6"
  gives "ChatGPT Work" and "WITH GPT-5.6". No model in the heading: leave the pill out.
- [DESCRIPTION]: one sentence from the paragraph on what the tool is, shortened to 20
  words or fewer without adding facts.
- Three feature tags: real capabilities named in that section (2 or 3 words each). Fewer
  than three in the section: use fewer tags. Never invent a feature.
- [TRENDING LINE]: the clearest single sentence from the Why This Tool Is Trending
  paragraphs, shortened to 16 words or fewer without adding facts.
- [TAKEAWAY LINE]: one sentence, 18 words or fewer, that sums up the AI Dominators
  Takeaway for this tool.
- The five use case sentences: copy each "For ..." line from Best Use Cases word for word,
  all five, never shortened and never split into separate items, so each stays one single
  line in its row.
- [EDITION DATES]: the earliest and newest item Date in the job, written like "28 APR TO 14
  JUL 2026" (one date if they are the same day). [EDITION LABEL]: "CATCH-UP EDITION" when the
  dates span more than 10 days, otherwise "THIS WEEK'S EDITION".
- Slogans (one short line each) and [CLOSING LINE] (two short imperatives, e.g. "BUILD
  WORKFLOWS. DELIVER OUTCOMES.") are written fresh and follow the newsletter writing rules:
  no emojis, no hyphens or dashes, no asterisks.
- Keep every snippet short so the image model can render it: use case sentences as written,
  everything else max 12 words. Never add an element not named in the structure above (no
  UI mockup, no tabs, no checklist, no progress ring, no tick lists, no FROM/TO/IMPACT
  flow) — the layout must stay simple and professional, not packed with extra visuals.

---

## Layout C — article hero (hero)

One cover image for the article, built around the ONE AI tool the article is about (from
the manager's reference "Unknown Facts of Google Veo 3.1" cover). It is a clean title card,
not an infographic: very little text, all of it large.

Pick the tool:
- [TOOL]: the main AI tool, product or model the article's headline is about, spelled exactly
  as in the items, with its version if the items give one (e.g. "Veo 3.1", "GPT-5.6",
  "Claude Code"). If the article covers several items, use the one its headline is about.
- [COMPANY]: the company that makes it, only if the items name it (e.g. "Google", "OpenAI").
  If the tool name already starts with the company ("ChatGPT Work", "Microsoft Copilot") or
  the items name no company, leave the company line out and show only [TOOL].
- If the article is not about one tool (a policy or industry story), use the main company or
  topic the headline names as [TOOL] and leave the company line out.

Write the prompt in this structure, filling every bracket:

```
A wide 16:9 landscape cover image (1536x1024), ultra detailed, crisp readable text, premium
tech poster style. Deep navy to black background with a soft [ACCENT] glow on the right and
faint glowing particles. Very little text, all of it large and sharp.

Left half, left aligned, top to bottom:
- a rounded pill with a thin glowing [ACCENT] border containing "UNKNOWN FACTS OF" in widely
  spaced bold white capitals
- the company name "[COMPANY]" as a huge bold wordmark in the company's own brand colours
  ([BRAND COLOURS])
- the tool name "[TOOL]" in huge heavy bold white letters, the largest text in the image
- a thin vertical [ACCENT] accent bar and, beside it, three lines of light grey text:
  "Hidden Features," / "Powerful Upgrades &" / "What You Didn't Know"

Right half: a large glowing circular [ACCENT] lens shaped orb, like a camera lens seen from
the front, with bright neon rings and thin orbit lines sweeping around it, and the tool name
"[TOOL]" in clean white letters in its dark centre. Around the orb, four round dark glass
icon badges with glowing [ACCENT] outline icons: [ICON 1] top left, [ICON 2] top right,
[ICON 3] bottom left, [ICON 4] bottom right.

Bottom right: a rounded glass pill with a thin glowing [ACCENT] border, a small rocket icon
and two lines of white text: "Smarter. Faster." / "More Powerful."

Style: futuristic, clean, high contrast, neon glow, sharp modern sans serif typography, all
text in English, no spelling mistakes, no extra text, no watermark, no people.
```

How to fill it:
- [ACCENT]: the tool's main brand colour as one glow colour (e.g. electric blue for Google,
  teal green for OpenAI, warm orange for Anthropic, purple for Meta). Default: electric blue.
- [BRAND COLOURS]: the company's well known wordmark colours, e.g. Google "G blue, o red,
  o yellow, g blue, l green, e red". If you are not sure of them, write "in bold white".
- Icons: [ICON 1] a magnifying glass, [ICON 2] a light bulb, [ICON 3] the icon for the tool's
  category, [ICON 4] a padlock. Category icons: video → film clapperboard with a play button,
  image → picture frame, coding → code brackets, chat or assistant → chat bubble, voice or
  music → microphone, search → globe, data or analytics → bar chart, agent or automation →
  gear with arrows, robotics → robot arm, anything else → a glowing chip.
- The title for this prompt (the `title` field) is "UNKNOWN FACTS OF [COMPANY] [TOOL]" in
  capitals, e.g. "UNKNOWN FACTS OF GOOGLE VEO 3.1" (without [COMPANY] when it is left out).
- Never write facts, numbers, scores or any other text into this image. The only text is
  the pill, the company, the tool name (twice), the three subtitle lines and the two
  tagline lines.

---

## Output shape

Return each prompt as an object `{ "section_key": "...", "title": "...", "prompt": "..." }`.
The `prompt` is the filled-in text block only (no markdown fences), max 7500 characters (the server rejects anything over 8000).
