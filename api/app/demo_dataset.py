"""Static definition of the seeded demo: one task, a 12-case dataset, and four
historical runs that show a realistic quality progression (with one regression
to make the run-to-run diff worth looking at).

Outputs and scores for the historical runs are synthesised deterministically by
``seed.py`` from the per-case ``outcomes`` below — see that module.
"""

from __future__ import annotations

# JSON schema the model is expected to produce for every case.
LEAD_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "name": {"type": ["string", "null"]},
        "company": {"type": ["string", "null"]},
        "email": {"type": ["string", "null"]},
        "budget_usd": {"type": ["integer", "null"]},
        "intent": {
            "type": "string",
            "enum": ["demo", "pricing", "support", "partnership", "other"],
        },
    },
    "required": ["name", "company", "email", "budget_usd", "intent"],
    "additionalProperties": False,
}

RUBRIC = (
    "Award full marks only when every field matches the expected lead. `name`, "
    "`company`, `email`, and `budget_usd` must be correct — use null when the "
    "message does not state a value — and `intent` must be the single best "
    "category. Penalise hallucinated companies, mis-parsed budgets (e.g. '120K' "
    "→ 120000), dropped null fields, and any altered email address. Minor "
    "differences in how a person's name is capitalised are acceptable."
)

SYSTEM_PROMPT = (
    "You are a precise sales-ops assistant. Extract structured lead data from a "
    "single inbound message and return ONLY a JSON object with exactly these "
    "keys: name, company, email, budget_usd, intent.\n"
    "Rules:\n"
    "- Use null for any field the message does not state. Do not guess.\n"
    "- budget_usd must be an integer in US dollars (e.g. '$120K' → 120000); "
    "use null if no budget is mentioned.\n"
    "- intent must be one of: demo, pricing, support, partnership, other.\n"
    "- Preserve the email address exactly as written.\n"
    "- Return only the JSON. No markdown, no commentary."
)

PROMPT_TEMPLATE = "Inbound message:\n\"\"\"\n{{input}}\n\"\"\"\n\nReturn the JSON object."

TASK = {
    "slug": "lead-extraction",
    "name": "Lead Extraction from Inbound Messages",
    "description": (
        "Extract structured lead data (name, company, email, budget, intent) from "
        "messy, real-world inbound messages — emails, DMs, and voicemail "
        "transcripts. The classic 'turn unstructured text into clean JSON' task "
        "that breaks in subtle ways when you change prompts or models."
    ),
    "input_label": "Inbound message",
    "output_label": "Extracted lead JSON",
    "system_prompt": SYSTEM_PROMPT,
    "prompt_template": PROMPT_TEMPLATE,
}

SCORERS = [
    {
        "name": "JSON schema",
        "type": "json_schema",
        "weight": 0.25,
        "config": {"schema": LEAD_SCHEMA},
    },
    {
        "name": "Exact match",
        "type": "exact_match",
        "weight": 0.25,
        "config": {"normalize_json": True},
    },
    {
        "name": "LLM judge",
        "type": "llm_judge",
        "weight": 0.50,
        "config": {"pass_threshold": 0.7},
    },
]

# Each case: name, input (messy), expected (canonical lead dict).
CASES: list[dict] = [
    {
        "name": "SaaStr booth lead — clear demo ask",
        "input": (
            "hey there — saw your booth at SaaStr. I'm Marcus Lee, run growth at "
            "Northwind Labs. we're evaluating tooling for Q3, prob looking to spend "
            "around 40k. can someone walk us through a demo next week? "
            "marcus@northwindlabs.io"
        ),
        "expected": {
            "name": "Marcus Lee",
            "company": "Northwind Labs",
            "email": "marcus@northwindlabs.io",
            "budget_usd": 40000,
            "intent": "demo",
        },
    },
    {
        "name": "Pricing question, no budget",
        "input": (
            "Hi, this is Priya Nair from Cedar & Co. Quick one — what does pricing "
            "look like for a team of 25? No rush. priya.nair@cedarandco.com"
        ),
        "expected": {
            "name": "Priya Nair",
            "company": "Cedar & Co",
            "email": "priya.nair@cedarandco.com",
            "budget_usd": None,
            "intent": "pricing",
        },
    },
    {
        "name": "Urgent support escalation",
        "input": (
            "URGENT. exports have been failing all morning, this is blocking our "
            "team. — Dana Whitfield, Ops @ Brightside Health. reach me "
            "dwhitfield@brightsidehealth.org"
        ),
        "expected": {
            "name": "Dana Whitfield",
            "company": "Brightside Health",
            "email": "dwhitfield@brightsidehealth.org",
            "budget_usd": None,
            "intent": "support",
        },
    },
    {
        "name": "Reseller / partnership inquiry",
        "input": (
            "Hello! We're a systems integrator (Helix Digital) and several of our "
            "clients keep asking about your platform. Would love to explore a "
            "partnership / reseller arrangement. — Tom Okafor, tom@helixdigital.co"
        ),
        "expected": {
            "name": "Tom Okafor",
            "company": "Helix Digital",
            "email": "tom@helixdigital.co",
            "budget_usd": None,
            "intent": "partnership",
        },
    },
    {
        "name": "Webinar follow-up — '$120K' budget parsing",
        "input": (
            "following up from the webinar. team of ~60, budget approved is $120K "
            "for the year. we'd want a tailored demo with our own data. — Sofia "
            "Marchetti, VP Eng, Quanta Logistics (sofia.m@quantalogistics.com)"
        ),
        "expected": {
            "name": "Sofia Marchetti",
            "company": "Quanta Logistics",
            "email": "sofia.m@quantalogistics.com",
            "budget_usd": 120000,
            "intent": "demo",
        },
    },
    {
        "name": "Sparse message — nulls for company & email",
        "input": "what's your pricing for the pro plan? considering it for my startup. ~ Jordan",
        "expected": {
            "name": "Jordan",
            "company": None,
            "email": None,
            "budget_usd": None,
            "intent": "pricing",
        },
    },
    {
        "name": "Praise, not a sales lead — intent 'other'",
        "input": (
            "Just wanted to say the new dashboard looks great. Keep it up! "
            "- Lena Fischer, lena@fischer.design"
        ),
        "expected": {
            "name": "Lena Fischer",
            "company": None,
            "email": "lena@fischer.design",
            "budget_usd": None,
            "intent": "other",
        },
    },
    {
        "name": "Demo request with mid-size budget",
        "input": (
            "Hi team, I'm Ahmed Khan at Vertex Mobility. We're scoping an eval tool "
            "and have about 25k set aside. Could we get a demo this month? "
            "a.khan@vertexmobility.io"
        ),
        "expected": {
            "name": "Ahmed Khan",
            "company": "Vertex Mobility",
            "email": "a.khan@vertexmobility.io",
            "budget_usd": 25000,
            "intent": "demo",
        },
    },
    {
        "name": "Agency pricing fit — chatty preamble",
        "input": (
            "Hope you're well! Long-time follower. We're a mid-size agency — Pixel "
            "& Pine. Trying to understand if your pricing fits SMB budgets before we "
            "pitch internally. Cheers, Grace Liu (grace@pixelandpine.studio)"
        ),
        "expected": {
            "name": "Grace Liu",
            "company": "Pixel & Pine",
            "email": "grace@pixelandpine.studio",
            "budget_usd": None,
            "intent": "pricing",
        },
    },
    {
        "name": "SSO outage — support with ticket noise",
        "input": (
            "ticket #4821 still open after 3 days?? SSO login broken for our whole "
            "org. need this fixed. Raj Patel, IT Director, Meridian Bank. "
            "rpatel@meridianbank.com"
        ),
        "expected": {
            "name": "Raj Patel",
            "company": "Meridian Bank",
            "email": "rpatel@meridianbank.com",
            "budget_usd": None,
            "intent": "support",
        },
    },
    {
        "name": "Enterprise rollout — '250k range', shouty caps",
        "input": (
            "VERY interested. enterprise rollout, ~500 seats. budget is in the 250k "
            "range. lets set up a DEMO asap. — Bianca Rossi // Director of AI // "
            "Solaris Group // bianca.rossi@solaris.group"
        ),
        "expected": {
            "name": "Bianca Rossi",
            "company": "Solaris Group",
            "email": "bianca.rossi@solaris.group",
            "budget_usd": 250000,
            "intent": "demo",
        },
    },
    {
        "name": "Co-marketing — plus-addressed email",
        "input": (
            "G'day — exploring co-marketing / partnership opportunities between our "
            "communities. I head DevRel at Loopback. ping me: "
            "dev+partners@loopback.dev — Cheers, Niamh Byrne"
        ),
        "expected": {
            "name": "Niamh Byrne",
            "company": "Loopback",
            "email": "dev+partners@loopback.dev",
            "budget_usd": None,
            "intent": "partnership",
        },
    },
]

# Historical runs, oldest first. `outcomes` maps case index → one of
# "correct" | "minor" | "wrong"; seed.py synthesises the output & scores.
RUNS: list[dict] = [
    {
        "label": "Baseline — terse prompt",
        "model": "kimi-k2.5",
        "params": {"temperature": 0.0, "max_tokens": 400},
        "days_ago": 18,
        "notes": "First pass. Short system prompt, no examples.",
        "outcomes": {
            0: "correct", 1: "correct", 2: "minor", 3: "correct", 4: "wrong",
            5: "correct", 6: "correct", 7: "minor", 8: "correct", 9: "correct",
            10: "minor", 11: "wrong",
        },
    },
    {
        "label": "Few-shot examples added",
        "model": "kimi-k2.5",
        "params": {"temperature": 0.0, "max_tokens": 400},
        "days_ago": 11,
        "notes": "Added two worked examples to the system prompt.",
        "outcomes": {
            0: "correct", 1: "correct", 2: "correct", 3: "correct", 4: "wrong",
            5: "correct", 6: "correct", 7: "minor", 8: "correct", 9: "correct",
            10: "correct", 11: "minor",
        },
    },
    {
        "label": "Upgraded to Kimi K2.6",
        "model": "kimi-k2.6",
        "params": {"temperature": 0.0, "max_tokens": 400},
        "days_ago": 4,
        "notes": "Same prompt, upgraded from K2.5 to K2.6. Big jump — but one regression.",
        "outcomes": {
            0: "correct", 1: "correct", 2: "correct", 3: "correct", 4: "correct",
            5: "correct", 6: "minor", 7: "minor", 8: "correct", 9: "correct",
            10: "correct", 11: "correct",
        },
    },
    {
        "label": "Tightened JSON instructions",
        "model": "kimi-k2.6",
        "params": {"temperature": 0.0, "max_tokens": 400},
        "days_ago": 1,
        "notes": "Explicit null-handling and budget-parsing rules. Fixed the regression.",
        "outcomes": {
            0: "correct", 1: "correct", 2: "correct", 3: "correct", 4: "correct",
            5: "correct", 6: "correct", 7: "minor", 8: "correct", 9: "correct",
            10: "correct", 11: "correct",
        },
    },
]
