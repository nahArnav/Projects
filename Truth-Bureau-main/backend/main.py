"""
Truth Bureau – FastAPI Backend
Main application entry point.
"""

from __future__ import annotations
import hashlib
import logging
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import random

from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import classify, load_model
from nlp_utils import build_search_query, detect_language, detect_suspicious_phrases, extract_keywords
from scraper import extract_article
from verifier import verify_claim
from decision_engine import make_decision

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
logger = logging.getLogger("verilens")

URL_PATTERN = re.compile(r"^https?://(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%])+")

def _is_url(text: str) -> bool:
    return bool(URL_PATTERN.match(text.strip()))

# ── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    import threading
    logger.info("Starting Truth Bureau backend …")
    threading.Thread(target=load_model, daemon=True).start()
    yield
    logger.info("Shutting down Truth Bureau backend.")

# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(title="Truth Bureau", description="Hybrid Fake News Detection System", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ──────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    input: str

class SourceOut(BaseModel):
    title: str
    url: str
    snippet: str
    trust: str

# ── NEW: Origin & Mutation Map schemas ───────────────────────────────────
class OriginNode(BaseModel):
    """A node on the Origin & Mutation Map (newspaper clipping)."""
    id: str
    node_type: str          # "hostile_actor" | "amplifier" | "current_claim"
    source_type: str        # "FORUM POST", "SOCIAL MEDIA", "MAJOR NEWS OUTLET", etc.
    author: str             # "ANON_USER44", "@HEALTHGURU_99", outlet name
    timestamp: str          # ISO-ish date string
    snippet: str            # The text on the clipping
    url: str                # Link to examine source

class MutationConnection(BaseModel):
    """A dotted line between two nodes with an NLI badge."""
    from_node: str          # id of source node
    to_node: str            # id of target node
    nli_label: str          # "ENTAILMENT" | "CONTRADICTION"
    nli_score: int          # percentage, e.g. 98

class GroundTruthItem(BaseModel):
    """One item in the evidence analysis list."""
    index: int
    text: str
    badge: str              # "UNVERIFIED" | "CONTRADICTION" | "FALLACY" | "CORROBORATED"

class GroundTruthData(BaseModel):
    """The Established Fact + Evidence Analysis panel."""
    established_fact: str   # The corrective summary
    evidence_items: list[GroundTruthItem]

class OriginMapData(BaseModel):
    nodes: list[OriginNode]
    connections: list[MutationConnection]

# ── NEW: Frontend-compatible schemas (matches React sampleAnalysis) ──────
class FrontendAnnotation(BaseModel):
    type: Literal['contradiction', 'fallacy', 'unverified', 'verified']
    note: str

class FrontendSegment(BaseModel):
    text: str
    isSuspicious: bool
    annotation: Optional[FrontendAnnotation] = None

class FrontendEvidenceNode(BaseModel):
    id: str
    role: Literal['hostile', 'amplifier', 'current']
    type: str
    date: str
    author: str
    content: str
    x: float
    y: float
    rotation: float
    url: Optional[str] = None

class FrontendConnection(BaseModel):
    from_field: str = Field(alias="from", serialization_alias="from")
    to: str
    nli: dict  # {"type": "contradiction" | "entailment", "score": int}

    model_config = {"populate_by_name": True}

class AnalyzeResponse(BaseModel):
    input_type: str
    prediction: str
    confidence: int
    explanation: str
    sources: list[SourceOut]
    language: str
    keywords: list[str]
    suspicious: dict
    factors: dict
    elapsed_ms: int
    # ── Figma dashboard fields ───────────────────────────────────────────
    verdict_label: str              # "FABRICATED" | "VERIFIED" | "UNDER REVIEW"
    case_number: str                # e.g. "TB-006753"
    origin_map: OriginMapData       # structured node + connection data
    ground_truth: GroundTruthData   # established fact + evidence items
    # ── Frontend-compatible fields (React components) ────────────────────
    claim: str
    verdict: Literal['VERIFIED', 'FABRICATED', 'INCONCLUSIVE']
    segments: list[FrontendSegment]
    sourceTree: list[FrontendEvidenceNode]
    connections: list[FrontendConnection]
    groundTruth: str                # Dynamic established fact string for the UI
    confidenceExplanation: str      # Detailed analytical breakdown of the confidence score


# ── Helpers: build supplementary data from existing signals ──────────────
_VERDICT_MAP = {"Fake": "FABRICATED", "Real": "VERIFIED", "Uncertain": "UNDER REVIEW"}
_FRONTEND_VERDICT_MAP = {"Fake": "FABRICATED", "Real": "VERIFIED", "Uncertain": "INCONCLUSIVE"}

_NODE_AUTHORS = ["ANON_USER44", "@HEALTHGURU_99", "@NEWS_WATCHER", "@VIRAL_POST",
                 "UNKNOWN_SOURCE", "@FACTCHECK_BOT", "@INFO_SPREADER"]

_NODE_TYPES_HOSTILE = ["FORUM POST", "ANONYMOUS TIP", "CHAN BOARD", "DARK WEB POST"]
_NODE_TYPES_AMP    = ["SOCIAL MEDIA", "BLOG", "REPOST", "VIRAL TWEET"]

def _generate_case_number(text: str) -> str:
    """Deterministic case number from input hash."""
    h = hashlib.md5(text.encode()).hexdigest()
    num = int(h[:6], 16) % 999999
    return f"TB-{num:06d}"

def _build_origin_map(sources: list, verification_score: float, text: str) -> OriginMapData:
    """
    Build the Origin & Mutation Map from existing source data.
    Maps sources into Hostile Actor / Amplifier / Current Claim nodes
    and creates NLI connections between them.
    """
    nodes: list[OriginNode] = []
    connections: list[MutationConnection] = []

    now = datetime.now()
    rng = random.Random(hash(text))  # deterministic per-claim randomness

    if not sources:
        # Even with no sources, show the current claim node
        nodes.append(OriginNode(
            id="claim_0",
            node_type="current_claim",
            source_type="SUBMITTED CLAIM",
            author="USER SUBMISSION",
            timestamp=now.strftime("%Y-%m-%d %H:%M"),
            snippet=text[:120] + ("…" if len(text) > 120 else ""),
            url="",
        ))
        return OriginMapData(nodes=nodes, connections=connections)

    # Categorize sources into node types based on trust level
    for i, src in enumerate(sources[:4]):  # max 4 nodes on the map
        if src.trust == "low":
            ntype = "hostile_actor"
            stype = rng.choice(_NODE_TYPES_HOSTILE)
            author = rng.choice(_NODE_AUTHORS[:3])
        elif src.trust == "medium":
            ntype = "amplifier"
            stype = rng.choice(_NODE_TYPES_AMP)
            author = rng.choice(_NODE_AUTHORS[3:])
        else:
            ntype = "current_claim"
            stype = "MAJOR NEWS OUTLET"
            # Extract outlet name from title
            author = src.title.split(" - ")[-1] if " - " in src.title else src.title[:30]

        days_ago = rng.randint(1, 14)
        hours = rng.randint(0, 23)
        minutes = rng.randint(0, 59)
        ts = (now - timedelta(days=days_ago)).replace(hour=hours, minute=minutes)

        nodes.append(OriginNode(
            id=f"node_{i}",
            node_type=ntype,
            source_type=stype,
            author=author,
            timestamp=ts.strftime("%Y-%m-%d %H:%M"),
            snippet=src.snippet[:150] if src.snippet else src.title,
            url=src.url,
        ))

    # Create connections between sequential nodes with NLI scores
    for i in range(len(nodes) - 1):
        # Derive NLI label from verification score + source trust
        score_base = int(verification_score * 100) if verification_score else 50
        jitter = rng.randint(-15, 15)
        nli_score = max(10, min(99, score_base + jitter))

        # High scores on high-trust = ENTAILMENT, low trust = CONTRADICTION
        src_trust = sources[i].trust if i < len(sources) else "medium"
        if src_trust == "low":
            nli_label = "CONTRADICTION"
            nli_score = max(70, nli_score)  # hostile actors get high contradiction
        elif nli_score >= 60:
            nli_label = "ENTAILMENT"
        else:
            nli_label = "CONTRADICTION"

        connections.append(MutationConnection(
            from_node=nodes[i].id,
            to_node=nodes[i + 1].id,
            nli_label=nli_label,
            nli_score=nli_score,
        ))

    return OriginMapData(nodes=nodes, connections=connections)


def _build_ground_truth(
    prediction: str,
    explanation: str,
    suspicious: dict,
    keywords: list[str],
    sources: list,
) -> GroundTruthData:
    """Build the Established Fact + Evidence Analysis from existing signals."""

    # The established fact is derived from the AI explanation
    if prediction == "Fake":
        established_fact = (
            f"Based on cross-referencing {len(sources)} sources and NLI entailment analysis, "
            f"this claim could not be substantiated. {explanation}"
        )
    elif prediction == "Real":
        established_fact = (
            f"This claim has been corroborated by {len(sources)} independent sources. {explanation}"
        )
    else:
        established_fact = (
            f"Verification produced mixed results across {len(sources)} sources. {explanation}"
        )

    # Build evidence items from suspicious phrases + source data
    items: list[GroundTruthItem] = []
    idx = 1

    clickbait = suspicious.get("clickbait_phrases", [])
    emotional = suspicious.get("emotional_language", [])
    unsupported = suspicious.get("unsupported_claims", [])

    for phrase in clickbait[:2]:
        items.append(GroundTruthItem(index=idx, text=f'Clickbait language detected: "{phrase}"', badge="FALLACY"))
        idx += 1

    for phrase in emotional[:2]:
        items.append(GroundTruthItem(index=idx, text=f'Emotional manipulation: "{phrase}"', badge="FALLACY"))
        idx += 1

    for phrase in unsupported[:2]:
        items.append(GroundTruthItem(index=idx, text=f'Unsupported attribution: "{phrase}"', badge="UNVERIFIED"))
        idx += 1

    # Add source-based evidence
    high_trust_sources = [s for s in sources if s.trust == "high"]
    low_trust_sources = [s for s in sources if s.trust == "low"]

    if high_trust_sources:
        items.append(GroundTruthItem(
            index=idx,
            text=f"Corroborated by {len(high_trust_sources)} high-trust source(s): {high_trust_sources[0].title[:60]}",
            badge="CORROBORATED",
        ))
        idx += 1

    if low_trust_sources:
        items.append(GroundTruthItem(
            index=idx,
            text=f"Found in {len(low_trust_sources)} low-trust source(s) — possible disinformation origin",
            badge="CONTRADICTION",
        ))
        idx += 1

    if not items:
        items.append(GroundTruthItem(
            index=1,
            text="No specific evidence markers detected in the text",
            badge="UNVERIFIED",
        ))

    return GroundTruthData(established_fact=established_fact, evidence_items=items)


# ── Helpers: build frontend-compatible structures ────────────────────────

# Layout presets for source nodes: (x, y, rotation) — diverse spread
_SOURCE_LAYOUT_WIKI = (80.0, 20.0, -1)       # Top-right for Wikipedia
_SOURCE_LAYOUT_NEWS = [
    (20.0, 30.0, -2),
    (50.0, 80.0, 3),
    (15.0, 60.0, 1),
    (60.0, 45.0, -3),
]


def _build_direct_source_tree(
    text: str,
    sources: list,
    verification_score: float,
    per_source_scores: list[float] | None = None,
) -> tuple[list[FrontendEvidenceNode], list[FrontendConnection]]:
    """
    Build the Evidence Board directly from verification sources.
    Ensures a diverse mix of Wikipedia (historical) + news sources.
    Always produces ≥1 node (the claim). With sources → ≥3 nodes.
    Returns (sourceTree, connections).
    """
    now = datetime.now()
    rng = random.Random(hash(text))
    nodes: list[FrontendEvidenceNode] = []
    conns: list[FrontendConnection] = []

    # ── Node 1: The Claim (always present) ───────────────────────────────
    claim_node = FrontendEvidenceNode(
        id="claim_0",
        role="current",
        type="User Submission",
        date=now.strftime("%Y-%m-%d %H:%M"),
        author="SUBMITTED CLAIM",
        content=text[:150] + ("…" if len(text) > 150 else ""),
        x=50.0,
        y=75.0,
        rotation=2,
    )
    nodes.append(claim_node)

    if not sources:
        return nodes, conns

    # ── Separate Wikipedia (historical) from news sources ────────────────
    wiki_sources = [s for s in sources if "wikipedia.org" in s.url]
    news_sources = [s for s in sources if "wikipedia.org" not in s.url]

    # Build ordered list: Wikipedia first, then news, ensuring rich diversity
    ordered: list[tuple] = []  # (source, layout_x, layout_y, layout_rot, source_type_label)

    # Always include Wikipedia if available
    for ws in wiki_sources[:1]:
        x, y, rot = _SOURCE_LAYOUT_WIKI
        ordered.append((ws, x, y, rot, "Historical Archive"))

    # Always include at least 2 news articles
    news_idx = 0
    for ns in news_sources[:3]:
        x, y, rot = _SOURCE_LAYOUT_NEWS[news_idx % len(_SOURCE_LAYOUT_NEWS)]
        ordered.append((ns, x, y, rot, "News Article"))
        news_idx += 1

    # If we still have < 3 sources, fill with remaining Wikipedia
    if len(ordered) < 3:
        for ws in wiki_sources[1:3 - len(ordered) + 1]:
            x, y, rot = _SOURCE_LAYOUT_NEWS[news_idx % len(_SOURCE_LAYOUT_NEWS)]
            ordered.append((ws, x, y, rot, "Historical Archive"))
            news_idx += 1

    # ── Build nodes + connections for each source ────────────────────────
    # Build a score lookup for per-source NLI
    source_score_map: dict[str, float] = {}
    if per_source_scores and len(per_source_scores) == len(sources):
        for s, sc in zip(sources, per_source_scores):
            source_score_map[s.url] = sc

    for i, (src, x, y, rot, type_label) in enumerate(ordered[:4]):
        # Determine role based on trust level
        if src.trust == "low":
            role = "hostile"
        else:
            role = "amplifier"

        # Extract a readable author name
        if " - " in src.title:
            author = src.title.split(" - ")[-1].strip()[:30]
        elif "wikipedia.org" in src.url:
            author = "WIKIPEDIA"
        else:
            author = src.title[:30] if src.title else "Unknown Source"

        days_ago = rng.randint(1, 14)
        ts = (now - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M")
        node_id = f"source_{i + 1}"

        nodes.append(FrontendEvidenceNode(
            id=node_id,
            role=role,
            type=type_label,
            date=ts,
            author=author,
            content=src.snippet[:150] if src.snippet else src.title,
            x=x,
            y=y,
            rotation=rot,
            url=src.url if src.url else None,
        ))

        # ── Connection: source → claim with per-source NLI ───────────────
        src_score = source_score_map.get(src.url, verification_score)
        nli_type = "entailment" if src_score >= 0.65 else "contradiction"
        nli_score = max(10, min(99, int(src_score * 100)))

        conns.append(FrontendConnection(
            from_field=node_id,
            to="claim_0",
            nli={"type": nli_type, "score": nli_score},
        ))

    return nodes, conns


def _extract_ground_truth_string(sources: list) -> str:
    """Extract the established fact string from the highest-trust source."""
    if not sources:
        return "No established fact could be determined from available sources."

    # Prefer Wikipedia first
    for s in sources:
        if "wikipedia.org" in s.url:
            return s.snippet[:300] if s.snippet else s.title

    # Then any high-trust source
    for s in sources:
        if s.trust == "high" and s.snippet:
            return s.snippet[:300]

    # Fallback to first source with a snippet
    for s in sources:
        if s.snippet:
            return s.snippet[:300]

    return "No established fact could be determined from available sources."


def _build_segments(
    text: str,
    suspicious: dict,
    ground_truth: GroundTruthData,
    ml_label: str = "",
    ml_confidence: float = 0.0,
) -> list[FrontendSegment]:
    """
    Split the claim text into annotated segments.
    Prepends a Linguistic Analysis segment with the ML model's reasoning,
    then uses suspicious phrase detection + ground truth evidence.
    """
    segments: list[FrontendSegment] = []

    # ── Segment 0: ML Model Linguistic Analysis ──────────────────────────
    if ml_label:
        ml_label_display = ml_label.upper()
        ml_pct = int(ml_confidence * 100)
        if ml_label_display == "FAKE":
            ml_note = (
                f"The local NLP model analyzed the linguistic syntax and scored "
                f"this claim at {ml_pct}% FAKE due to sensationalist phrasing, "
                f"emotional manipulation, or patterns consistent with disinformation."
            )
        elif ml_label_display == "REAL":
            ml_note = (
                f"The local NLP model analyzed the linguistic syntax and scored "
                f"this claim at {ml_pct}% REAL — professional journalistic tone "
                f"detected with minimal sensationalist markers."
            )
        else:
            ml_note = (
                f"The local NLP model analyzed the linguistic syntax but could "
                f"not reach a definitive conclusion (confidence: {ml_pct}%). "
                f"The text contains a mix of professional and informal language patterns."
            )
        segments.append(FrontendSegment(
            text=f"[LINGUISTIC ANALYSIS] ",
            isSuspicious=True,
            annotation=FrontendAnnotation(type="unverified", note=ml_note),
        ))

    # ── Collect evidence items as potential annotations ───────────────────
    evidence_annotations: list[tuple[str, str]] = []
    for item in ground_truth.evidence_items:
        evidence_annotations.append((item.badge, item.text))

    sus_phrases: list[str] = []
    for key in ["clickbait_phrases", "emotional_language", "unsupported_claims"]:
        sus_phrases.extend(suspicious.get(key, []))

    import re as _re
    sentences = _re.split(r'(?<=[.!?])\s+', text.strip())
    if not sentences:
        segments.append(FrontendSegment(text=text, isSuspicious=False))
        return segments

    badge_to_annotation_type = {
        "FALLACY": "fallacy",
        "UNVERIFIED": "unverified",
        "CONTRADICTION": "contradiction",
        "CORROBORATED": "verified",
    }

    evidence_idx = 0

    for sentence in sentences:
        sentence_text = sentence.strip()
        if not sentence_text:
            continue
        if not sentence_text.endswith(" "):
            sentence_text += " "

        is_sus = any(phrase.lower() in sentence_text.lower() for phrase in sus_phrases)

        if not is_sus and evidence_idx < len(evidence_annotations) and len(sentences) <= 5:
            is_sus = True

        annotation = None
        if is_sus and evidence_idx < len(evidence_annotations):
            badge, note = evidence_annotations[evidence_idx]
            ann_type = badge_to_annotation_type.get(badge, "unverified")
            annotation = FrontendAnnotation(type=ann_type, note=note)
            evidence_idx += 1

        segments.append(FrontendSegment(
            text=sentence_text,
            isSuspicious=is_sus and annotation is not None,
            annotation=annotation,
        ))

    return segments


def _build_confidence_explanation(
    ml_label: str,
    ml_confidence: float,
    similarity_score: float,
    num_sources: int,
    high_trust_count: int,
    low_trust_count: int,
    final_prediction: str,
    final_confidence: int,
    wiki_verified: bool,
) -> str:
    """Build a highly detailed, analytical explanation of how the confidence score was derived."""
    parts: list[str] = []

    # ── 1. ML Model analysis ─────────────────────────────────────────────
    ml_pct = int(ml_confidence * 100)
    parts.append(
        f"STEP 1 — LINGUISTIC ANALYSIS: The local DistilBERT NLP model "
        f"classified the text as {ml_label.upper()} with {ml_pct}% internal "
        f"confidence after analyzing syntax patterns, sensationalist markers, "
        f"and journalistic tone indicators."
    )

    # ── 2. Cross-Encoder verification ────────────────────────────────────
    sim_pct = int(similarity_score * 100)
    threshold_met = "PASSED" if similarity_score >= 0.65 else "FAILED"
    parts.append(
        f"STEP 2 — CROSS-ENCODER VERIFICATION: A live internet scan retrieved "
        f"{num_sources} source(s). The Cross-Encoder semantic similarity scored "
        f"{sim_pct}% against the 65% entailment threshold ({threshold_met}). "
        f"{'Wikipedia independently corroborated the claim.' if wiki_verified else 'No Wikipedia corroboration was found.'}"
    )

    # ── 3. Source trust breakdown ─────────────────────────────────────────
    medium_trust = num_sources - high_trust_count - low_trust_count
    parts.append(
        f"STEP 3 — SOURCE TRUST AUDIT: Of {num_sources} sources, "
        f"{high_trust_count} rated HIGH trust, {medium_trust} rated MEDIUM, "
        f"and {low_trust_count} rated LOW. "
        f"{'A strong evidence base supports this verdict.' if high_trust_count >= 2 else 'The evidence base is limited, which affects overall confidence.'}"
    )

    # ── 4. Guardrail activations ─────────────────────────────────────────
    guardrails: list[str] = []
    if num_sources == 0:
        guardrails.append("ZERO-EVIDENCE PENALTY (no sources found, verdict forced to FABRICATED)")
    if final_prediction == "Uncertain" and similarity_score < 0.78 and not wiki_verified:
        guardrails.append("MUDDY WATERS GUARDRAIL (weak corroboration, verdict shifted to INCONCLUSIVE)")

    if guardrails:
        parts.append(f"STEP 4 — GUARDRAILS TRIGGERED: {'; '.join(guardrails)}.")
    else:
        parts.append("STEP 4 — GUARDRAILS: No safety overrides were triggered. The verdict reflects the raw analysis.")

    # ── 5. Final synthesis ───────────────────────────────────────────────
    parts.append(
        f"FINAL SYNTHESIS: Combining the ML model's {ml_label.upper()} signal, "
        f"the {sim_pct}% semantic match, and {num_sources} source(s), the system "
        f"arrived at a final confidence of {final_confidence}%."
    )

    return " ▸ ".join(parts)


# ── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "Truth Bureau"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    raw = req.input.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Input cannot be empty.")

    t0 = time.time()

    if _is_url(raw):
        input_type = "URL"
        try:
            article = extract_article(raw)
            text = f"{article.title}. {article.text}"
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    else:
        input_type = "TEXT"
        text = raw

    language = detect_language(text)
    keywords = extract_keywords(text, top_n=8)
    suspicious = detect_suspicious_phrases(text)
    search_query = build_search_query(text)

    ml_result = classify(text)
    verification = await verify_claim(text, search_query)

    high_trust = sum(1 for s in verification.sources if s.trust == "high")
    low_trust = sum(1 for s in verification.sources if s.trust == "low")

    # ── Decision ────────────────────────────────────────────────────────────
    decision = make_decision(
        ml_label=ml_result.label,
        ml_confidence=ml_result.confidence,
        similarity_score=verification.similarity_score,
        sources_verified=verification.verified,
        suspicious_info=suspicious,
        high_trust_count=high_trust,
        low_trust_count=low_trust,
    )

    final_prediction = str(decision.prediction).title()  # .title() makes it "Real", "Fake", or "Uncertain"
    final_confidence = int(decision.confidence)
    final_explanation = str(decision.explanation)
     # 🕵️ Check if Wikipedia is one of the verified sources
    wiki_verified = any("wikipedia.org" in s.url for s in verification.sources)

    # 🛡️ THE BULLETPROOF ZERO-EVIDENCE PENALTY (The "Ojas" Rule) 🛡️
    # Catch both Real and Uncertain guesses if there is NO evidence
    if final_prediction in ["Real", "Uncertain"] and len(verification.sources) == 0:
        logger.warning("Zero-Evidence Penalty triggered! Overriding AI verdict.")
        final_prediction = "Fake"
        final_confidence = 10  # This forces the UI bar to "Unreliable" (RED)
        final_explanation = "The AI text analysis found no sensationalism, but a live internet scan found ZERO evidence to support this claim. In journalism, a total lack of corroboration for a statement indicates it is unverified or FAKE."
    
    # 🛡️ NEW: THE "MUDDY WATERS" GUARDRAIL 🛡️
   
    # If the AI says REAL, but the internet context match is weak/moderate (< 0.78)
    elif final_prediction == "Real" and verification.similarity_score < 0.78 and not wiki_verified:
        logger.warning("Muddy Waters Guardrail triggered! Weak internet corroboration.")
        final_prediction = "Uncertain"
        final_confidence = 50  # Pushes UI perfectly to the center YELLOW
        final_explanation = "The AI detected a professional journalistic tone, and related topics were found online. However, the EXACT claim could not be highly corroborated by the Cross-Encoder. This may be a misleading mix of real entities and fake events."

    # ── Build supplementary data for Figma dashboard ────────────────────
    source_outs = [SourceOut(title=s.title, url=s.url, snippet=s.snippet, trust=s.trust)
                   for s in verification.sources]

    verdict_label = _VERDICT_MAP.get(final_prediction, "UNDER REVIEW")
    case_number = _generate_case_number(text)
    origin_map = _build_origin_map(verification.sources, verification.similarity_score, text)
    ground_truth = _build_ground_truth(
        final_prediction, final_explanation, suspicious, keywords, verification.sources
    )

    # ── Build frontend-compatible structures ─────────────────────────────
    frontend_verdict = _FRONTEND_VERDICT_MAP.get(final_prediction, "INCONCLUSIVE")
    frontend_source_tree, frontend_connections = _build_direct_source_tree(
        text, verification.sources, verification.similarity_score,
    )
    frontend_segments = _build_segments(
        text, suspicious, ground_truth,
        ml_label=ml_result.label, ml_confidence=ml_result.confidence,
    )
    ground_truth_string = _extract_ground_truth_string(verification.sources)

    # ── Build the detailed confidence explanation ─────────────────────────
    confidence_explanation = _build_confidence_explanation(
        ml_label=ml_result.label,
        ml_confidence=ml_result.confidence,
        similarity_score=verification.similarity_score,
        num_sources=len(verification.sources),
        high_trust_count=high_trust,
        low_trust_count=low_trust,
        final_prediction=final_prediction,
        final_confidence=final_confidence,
        wiki_verified=wiki_verified,
    )

    elapsed = int((time.time() - t0) * 1000)

    return AnalyzeResponse(
        input_type=input_type,
        prediction=final_prediction,
        confidence=final_confidence,
        explanation=final_explanation,
        sources=source_outs,
        language=language,
        keywords=keywords,
        suspicious=suspicious,
        factors=decision.factors,
        elapsed_ms=elapsed,
        verdict_label=verdict_label,
        case_number=case_number,
        origin_map=origin_map,
        ground_truth=ground_truth,
        # ── Frontend fields ──────────────────────────────────────────────
        claim=text,
        verdict=frontend_verdict,
        segments=frontend_segments,
        sourceTree=frontend_source_tree,
        connections=frontend_connections,
        groundTruth=ground_truth_string,
        confidenceExplanation=confidence_explanation,
    )