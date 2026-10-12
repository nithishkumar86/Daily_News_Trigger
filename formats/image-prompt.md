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

Article → exactly 1 prompt with section_key `hero` and the article's H1 headline as the title.

---

## Layout A — "Top 5" sections (world, tools, insights)

All three Top 5 images (World News, Tool Updates, Insights) use this same structure.
Goal: the image must stand on its own. A person who never opens the newsletter should
understand every story just by reading the image. So the image is: the section heading,
one line saying what the reader will learn, then the section split into vertical columns,
one per story, each with the story's headline and its two sentences in large, readable text.
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
- the story's two sentences as two short paragraphs of large, high contrast white text, easy to read at a glance
- an icon in a circle plus the label "[LABEL A]" in the column colour and one or two lines of white text
- an icon in a circle plus the label "[LABEL B]" in the column colour and one or two lines of white text

Column 1: headline "[HEADLINE 1]", wordmark "[COMPANY 1]", illustration: [ILLUSTRATION 1],
sentence 1: "[SENTENCE 1A]", sentence 2: "[SENTENCE 1B]",
[LABEL A]: "[TEXT 1A]", [LABEL B]: "[TEXT 1B]".
Column 2: ...  (repeat for every column)

Bottom: a full width dark strip with five evenly spaced items separated by thin lines,
each a coloured glowing icon plus short white text: "[SLOGAN 1]" | "[SLOGAN 2]" |
"[SLOGAN 3]" | "[SLOGAN 4]" | "[SLOGAN 5]".

Style: futuristic, clean, high contrast, neon glow, sharp typography, body text large
enough to read on a phone, no tiny text, no spelling mistakes, all text in English,
no watermark. Any people are stylised digital illustrations, never real or recognisable people.
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
- Sentence 1: the key sentence of the entry's first paragraph (what happened).
- Sentence 2: the key sentence of the entry's second paragraph (what it does or why it is
  important). If a sentence is longer than 25 words, use its shorter sentence from the same
  paragraph instead; never invent a new one.
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
- Keep every text snippet short, because image models garble long text: headline max 8
  words, each sentence max 25 words, each box max 25 words.

Style reference (columns built from the manager's real images; match their shape and
length, never copy their facts):

```
Tools column 1: headline "GPT-5.6 and ChatGPT Work", wordmark "OpenAI | ChatGPT WORK",
illustration: a glowing project roadmap dashboard with Research, Analysis, Strategy and
Execution steps, sentence 1: "OpenAI introduced GPT-5.6 on July 9, alongside ChatGPT Work.",
sentence 2: "ChatGPT Work is designed to help users connect tools, manage projects and turn
goals into completed outputs.", WHY IT MATTERS: "ChatGPT is moving beyond individual
conversations. It is becoming a workspace where AI can analyse information, create
deliverables and support longer projects.", BEST USE CASE: "Reports, business planning,
coding, data analysis, campaign creation and multi step project execution."

Insights column 2: headline "INFRASTRUCTURE BECAME THE FUNDING WINNER" with "FUNDING
WINNER" in orange, wordmarks "baseten $1.5B | SambaNova $1B | supabase $500M",
illustration: a glowing cloud above rows of neon server racks, sentence 1: "Baseten,
SambaNova and Supabase attracted a combined $3 billion during the period.", sentence 2:
"All three help other companies build, deploy or operate technology rather than competing
only through a consumer chatbot.", WHAT IT MEANS: "The hidden winners of the AI boom may be
the companies providing computing, databases, deployment systems, energy and data centre
capacity.", AI DOMINATORS TAKEAWAY: "Cloud AI, data engineering, automation and AI
deployment are strong career and business opportunities."
```

---

## Layout B — trending tool (trending)

This is the only image with the five audience use cases. Write the prompt in this
structure, filling every bracket:

```
A wide 16:9 landscape infographic (1536x1024), ultra detailed, crisp readable text,
premium tech poster style. Deep navy to black background with subtle glowing circuit lines.

Top left: a glowing circular neon badge with a small rising arrow and the words
"TRENDING NOW". Top center: huge bold headline "AI TRENDING TOOL" in white with "TOOL" in
a cyan to teal gradient, and below it "OF THE WEEK" in widely spaced white capitals between
two thin glowing lines. Top right: a rounded neon bordered badge with a star icon and two
lines: "[EDITION LABEL]" in white and "[EDITION DATES]" in teal.

Left side (about 60 percent of the width), a large rounded glass panel:
- top left: a large rounded app icon tile for the tool, next to the tool name "[TOOL NAME]"
  as a huge two tone wordmark (first word white, second word teal), and under it a teal pill
  with "[WITH MODEL]"
- below: one line of large white text: "[DESCRIPTION, max 20 words]"
- below: four feature rows, each a round neon icon, a teal title and one short white line:
  "[FEATURE 1 TITLE]" "[FEATURE 1 LINE]", "[FEATURE 2 TITLE]" "[FEATURE 2 LINE]",
  "[FEATURE 3 TITLE]" "[FEATURE 3 LINE]", "[FEATURE 4 TITLE]" "[FEATURE 4 LINE]"
- right part of the panel: a large glowing UI mockup of the tool in action: a top tab bar
  with four tabs ([TAB 1], [TAB 2], [TAB 3], [TAB 4]), a left sidebar, and a main area
  showing [MOCKUP TASK], with a short checklist of steps (some ticked), a progress ring and
  a glowing "[ACTION BUTTON]" button

Under the left panel, a wide glass strip: a glowing neon brain on the left, the heading
"WHY THIS TOOL IS TRENDING" in gold, the text "[TRENDING LINE 1]" and "[TRENDING LINE 2]"
with the tool name in teal; then a three step flow with icons and arrows: "FROM" "[FROM]"
then "TO" "[TO]" then "IMPACT" "[IMPACT]"; and on the right a gold bordered box with a
trophy, the title "AI DOMINATORS TAKEAWAY" and three short lines: "[TAKEAWAY 1]"
"[TAKEAWAY 2]" "[TAKEAWAY 3]".

Right side (about 40 percent of the width): the heading "BEST USE CASES" between two thin
glowing arrows, then five stacked horizontal glass cards, each with a stylised illustrated
person working at a laptop on the left, a round neon icon, a bold title in the card colour,
the use case sentence in white, and on the right four short items with ticks in the card colour:
1. purple card, graduation cap icon, "FOR STUDENTS": "[STUDENTS SENTENCE]", ticks: [4 ITEMS]
2. blue card, rocket icon, "FOR FREELANCERS": "[FREELANCERS SENTENCE]", ticks: [4 ITEMS]
3. green card, briefcase icon, "FOR WORKING PROFESSIONALS": "[PROFESSIONALS SENTENCE]", ticks: [4 ITEMS]
4. orange card, rising bar chart icon, "FOR BUSINESS OWNERS": "[BUSINESS OWNERS SENTENCE]", ticks: [4 ITEMS]
5. teal card, house icon, "FOR REAL ESTATE PROFESSIONALS": "[REAL ESTATE SENTENCE]", ticks: [4 ITEMS]

Bottom: a full width dark strip with four items separated by thin lines, each a coloured
glowing icon and two short white lines: "[SLOGAN 1]" | "[SLOGAN 2]" | "[SLOGAN 3]" |
"[SLOGAN 4]", and on the far right a rounded neon bordered pill with "[CLOSING LINE]
THAT'S HOW AI DOMINATORS WIN." with "AI DOMINATORS" in teal.

Style: futuristic, clean, high contrast, neon glow, sharp typography, body text large
enough to read on a phone, no tiny text, no spelling mistakes, all text in English,
no watermark. People are stylised digital illustrations, never real or recognisable people.
```

What goes where (everything comes from the trending tool section you wrote):
- [TOOL NAME] and [WITH MODEL]: from the tool heading, e.g. "ChatGPT Work With GPT-5.6"
  gives "ChatGPT Work" and "WITH GPT-5.6". No model in the heading: leave the pill out.
- [DESCRIPTION]: one sentence from the paragraph on what the tool is, shortened to 20
  words or fewer without adding facts.
- Four features: real capabilities named in that section (2 or 3 word title, line max 10
  words). Fewer than four in the section: use fewer rows. Never invent a feature.
- [TRENDING LINE 1]: the first paragraph under Why This Tool Is Trending, word for word.
  [TRENDING LINE 2]: the first sentence of the second paragraph, word for word.
  FROM / TO / IMPACT: the shift that paragraph describes, 2 or 3 words each (e.g. "One
  Prompt", "Complete Outcomes", "More clarity. Better results.").
- Takeaway box: three lines of 2 or 3 words that sum up the AI Dominators Takeaway (e.g.
  "Master workflows." "Deliver real outcomes." "Stay ahead.").
- The five use case sentences: copy each "For ..." line from Best Use Cases word for word,
  all five, never shortened. The four ticks on each card are the tasks named in that same
  sentence, 1 to 3 words each (e.g. "Study plans", "Revision guides", "Practice questions").
- [EDITION DATES]: the earliest and newest item Date in the job, written like "28 APR TO 14
  JUL 2026" (one date if they are the same day). [EDITION LABEL]: "CATCH-UP EDITION" when the
  dates span more than 10 days, otherwise "THIS WEEK'S EDITION".
- [MOCKUP TASK] and the tabs: a realistic task from the use cases, e.g. a marketing campaign
  plan with steps Research market, Analyse competitors, Create campaign strategy.
- Slogans (two short lines each) and [CLOSING LINE] (two short imperatives, e.g. "BUILD
  WORKFLOWS. DELIVER OUTCOMES.") are written fresh and follow the newsletter writing rules:
  no emojis, no hyphens or dashes, no asterisks.
- Keep every snippet short so the image model can render it: use case sentences as written,
  everything else max 12 words.

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
The `prompt` is the filled-in text block only (no markdown fences), max 7500 characters (the server rejects anything over 8000).
