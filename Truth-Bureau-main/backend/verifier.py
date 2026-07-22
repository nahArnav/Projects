"""
Internet Verifier for Truth Bureau
- Searches the web via Google News RSS for live, rate-limit-proof verification.
- Searches Wikipedia API for historical fact verification.
- Computes strict semantic entailment using a Cross-Encoder.
"""

from __future__ import annotations
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import re
import json  # <-- Added for Wikipedia API
import numpy as np  # <-- Added for softmax over NLI logits

import asyncio
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ── Lazy-loaded Cross-Encoder ────────────────────────────────────────
_cross_model = None

def _get_cross_model():
    global _cross_model
    if _cross_model is None:
        try:
            from sentence_transformers import CrossEncoder
            logger.info("Loading Multilingual NLI Cross-Encoder model…")
            # ⚡ Multilingual mDeBERTa — supports 100+ languages for global claim verification
            # Label order: [entailment=0, neutral=1, contradiction=2]
            _cross_model = CrossEncoder("MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7")
            logger.info("Multilingual NLI Cross-Encoder loaded successfully.")
        except Exception as exc:
            logger.warning("Could not load NLI Cross-Encoder: %s", exc)
    return _cross_model


@dataclass
class SourceArticle:
    title: str
    url: str
    snippet: str
    trust: str = "medium"  # "high", "medium", "low"


@dataclass
class VerificationResult:
    similarity_score: float = 0.0
    sources: list[SourceArticle] = field(default_factory=list)
    verified: bool = False


# ── Trusted domains (Expanded Global & Indian Scope) ───────────────────────
HIGH_TRUST_DOMAINS = {
    "wikipedia.org",  # <-- Added Wikipedia as a Ground Truth Source

    # 🌍 Global Wire Services (The original sources of most news)
    "reuters.com", "apnews.com", "bloomberg.com", "afp.com", "upi.com",

    # 🇺🇸/🇬🇧 Major US, UK & International Media
    "bbc.com", "bbc.co.uk", "nytimes.com", "washingtonpost.com", "wsj.com",
    "theguardian.com", "npr.org", "pbs.org", "cnn.com", "ft.com",
    "aljazeera.com", "dw.com", "france24.com", "scmp.com", "nbcnews.com",
    "cbsnews.com", "abcnews.go.com", "theatlantic.com", "time.com", "economist.com",

    # 🇮🇳 Indian National & Regional Heavyweights
    "thehindu.com", "hindustantimes.com", "indianexpress.com", "timesofindia.indiatimes.com",
    "ndtv.com", "indiatoday.in", "theprint.in", "thewire.in", "scroll.in",
    "livemint.com", "business-standard.com", "deccanherald.com", "telegraphindia.com",
    "tribuneindia.com", "newindianexpress.com", "firstpost.com", "thequint.com",
    "cnbctv18.com", "moneycontrol.com", "aninews.in", "ptinews.com", "freepressjournal.in",

    # 🔎 Dedicated Fact-Checkers (Massive Trust Boost if found)
    "snopes.com", "politifact.com", "factcheck.org", "altnews.in", "boomlive.in",
    "newschecker.in", "vishvasnews.com", "smhoaxinvestigator.com", "factchecker.in",

    # 🌐 High-Trust Aggregators
    "yahoo.com/news", "msn.com", "news.google.com"
}

# ── Low Trust / Disinformation / Satire domains ────────────────────────────
LOW_TRUST_DOMAINS = {
    # ⚠️ Known Fake News, Pseudoscience & Conspiracy
    "infowars.com", "naturalnews.com", "beforeitsnews.com", "thegatewaypundit.com",
    "zerohedge.com", "worldnewsdailyreport.com", "nationalreport.net",

    # 📢 State-Sponsored Propaganda
    "rt.com", "sputniknews.com", "globaltimes.cn",

    # 🇮🇳 Indian High-Bias / Frequently Flagged for Disinformation
    "postcard.news", "opindia.com", "tfipost.com", "kreately.in", "rightlog.in",

    # 🤡 Satire (If your engine matches these, the news is definitely fake)
    "theonion.com", "babylonbee.com", "fakingnews.com", "thefauxy.com",
    "thedailymash.co.uk", "waterfordwhispersnews.com", "clickhole.com"
}


def _trust_level(url: str, snippet: str = "", title: str = "") -> str:
    """Evaluates trust based on URL domain AND snippet/title signatures."""
    lower_url = url.lower()
    lower_snippet = snippet.lower()
    lower_title = title.lower()

    # 1. Check URL Domains
    for d in HIGH_TRUST_DOMAINS:
        if d in lower_url:
            return "high"
            
    # 2. Check snippet OR title for major syndicated wire services
    high_trust_keywords = ["reuters", "associated press", "bbc", "cnn", "the new york times", "bloomberg"]
    for keyword in high_trust_keywords:
        if keyword in lower_snippet or keyword in lower_title:
            return "high"

    # 3. Check for known low-trust/satire sites
    for d in LOW_TRUST_DOMAINS:
        if d in lower_url:
            return "low"
            
    return "medium"


# ── Locale detection for multilingual search ─────────────────────────────
_LOCALE_MAP = {
    (0x0900, 0x097F): ('hi', 'IN'),   # Devanagari → Hindi
    (0x0980, 0x09FF): ('bn', 'IN'),   # Bengali
    (0x0A00, 0x0A7F): ('pa', 'IN'),   # Gurmukhi → Punjabi
    (0x0A80, 0x0AFF): ('gu', 'IN'),   # Gujarati
    (0x0B80, 0x0BFF): ('ta', 'IN'),   # Tamil
    (0x0C00, 0x0C7F): ('te', 'IN'),   # Telugu
    (0x0C80, 0x0CFF): ('kn', 'IN'),   # Kannada
    (0x0D00, 0x0D7F): ('ml', 'IN'),   # Malayalam
    (0x0600, 0x06FF): ('ar', 'AE'),   # Arabic
    (0x4E00, 0x9FFF): ('zh', 'CN'),   # CJK → Chinese
    (0x3040, 0x30FF): ('ja', 'JP'),   # Hiragana/Katakana → Japanese
    (0xAC00, 0xD7AF): ('ko', 'KR'),   # Hangul → Korean
    (0x0400, 0x04FF): ('ru', 'RU'),   # Cyrillic → Russian
}


def _detect_locale(query: str) -> tuple[str, str]:
    """Detect (lang, country) from the Unicode script of the first non-ASCII char."""
    for c in query:
        cp = ord(c)
        for (lo, hi), locale in _LOCALE_MAP.items():
            if lo <= cp <= hi:
                return locale
    return ('en', 'US')  # default to English


def _fetch_google_rss(url: str, num_results: int) -> list[dict]:
    """Fetch and parse a Google News RSS URL into a list of result dicts."""
    print(f"  🌐 GOOGLE NEWS URL: {url}")
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        xml_data = response.read()
    root = ET.fromstring(xml_data)
    results = []
    for item in root.findall('.//item')[:num_results]:
        title = item.find('title')
        link = item.find('link')
        title_text = title.text if title is not None else ""
        link_text = link.text if link is not None else ""
        desc = item.find('description')
        desc_html = desc.text if desc is not None else ""
        snippet = re.sub('<[^<]+>', '', desc_html)
        results.append({"title": title_text, "href": link_text, "body": snippet})
    print(f"  📰 Results found: {len(results)}")
    return results


def _google_news_search(query: str, num_results: int = 8) -> list[dict]:
    """
    Multilingual Google News RSS search.
    1. Detect locale from query script (Hindi→hi/IN, Bengali→bn/IN, etc.)
    2. Search with detected locale
    3. Fallback: search with no locale (Google auto-detects)
    4. Fallback: slice to first 6 words and retry
    """
    try:
        safe_query = urllib.parse.quote(query)
        lang, country = _detect_locale(query)

        print(f"\n{'='*50}")
        print(f"🔍 GOOGLE NEWS SEARCH")
        print(f"  Query: {query[:80]}{'...' if len(query) > 80 else ''}")
        print(f"  Detected locale: hl={lang}, gl={country}")

        # Attempt 1: Search with detected locale
        url = f"https://news.google.com/rss/search?q={safe_query}&hl={lang}&gl={country}&ceid={country}:{lang}"
        results = _fetch_google_rss(url, num_results)

        # Attempt 2: No locale params → let Google infer
        if not results:
            print("  ⚠️ Zero results. Retrying with no locale params...")
            url_nolang = f"https://news.google.com/rss/search?q={safe_query}"
            results = _fetch_google_rss(url_nolang, num_results)

        # Attempt 3: Query slicing → first 6 words only
        if not results:
            words = query.split()
            if len(words) > 4:
                short_query = " ".join(words[:6])
                safe_short = urllib.parse.quote(short_query)
                print(f"  ⚠️ Still zero. Slicing to 6 words: '{short_query}'")
                url_short = f"https://news.google.com/rss/search?q={safe_short}&hl={lang}&gl={country}&ceid={country}:{lang}"
                results = _fetch_google_rss(url_short, num_results)

        print(f"  ✅ Final result count: {len(results)}")
        print(f"{'='*50}\n")
        return results

    except Exception as exc:
        logger.error("Google News search failed: %s", exc)
        return []


def _wikipedia_search(query: str) -> list[dict]:
    """
    Multilingual Wikipedia search.
    Tries English first, then falls back to the language-specific edition
    if the query contains non-ASCII characters.
    """
    def _wiki_query(wiki_lang: str, q: str) -> list[dict]:
        safe_query = urllib.parse.quote(q)
        url = f"https://{wiki_lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={safe_query}&utf8=&format=json"
        print(f"  📚 WIKIPEDIA URL ({wiki_lang}): {url[:120]}...")
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'VeriLensAI/1.0 (University Fact-Checking Project)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
        results = []
        for item in data.get('query', {}).get('search', [])[:2]:
            title = item['title']
            clean_snippet = re.sub('<[^<]+>', '', item['snippet'])
            results.append({
                "title": f"{title} - Wikipedia",
                "href": f"https://{wiki_lang}.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "body": clean_snippet
            })
        print(f"  📚 Wikipedia ({wiki_lang}) results: {len(results)}")
        return results

    try:
        # 1. Try English Wikipedia first
        results = _wiki_query('en', query)

        # 2. If 0 results and query contains non-ASCII, detect language Wikipedia
        if not results and any(ord(c) > 127 for c in query):
            detected_lang, _ = _detect_locale(query)
            if detected_lang != 'en':
                logger.info(f"Retrying Wikipedia with lang={detected_lang} for non-ASCII query")
                results = _wiki_query(detected_lang, query)

        return results
    except Exception as exc:
        logger.error("Wikipedia search failed: %s", exc)
        return []


async def _search_web(query: str, num_results: int = 8) -> list[dict]:
    """Search the web for news AND historical facts concurrently, with short-query fallback."""

    # Run Google News and Wikipedia at the exact same time
    news_task = asyncio.to_thread(_google_news_search, query, num_results)
    wiki_task = asyncio.to_thread(_wikipedia_search, query)

    # Wait for both to finish
    news_results, wiki_results = await asyncio.gather(news_task, wiki_task)

    # Allocate half the quota to each source to ensure balanced verification
    half_quota = num_results // 2
    balanced_results = news_results[:half_quota] + wiki_results[:num_results - half_quota]

    # If Wiki returned fewer results than its quota, fill the gap with more news
    if len(balanced_results) < num_results:
        remaining_slots = num_results - len(balanced_results)
        balanced_results.extend(news_results[half_quota:half_quota + remaining_slots])

    # 🔄 SHORT-QUERY FALLBACK: If 0 results, retry with just the first 6 words
    if not balanced_results:
        words = query.split()
        if len(words) > 4:
            short_query = " ".join(words[:6])
            logger.info(f"Zero results for full query. Retrying with short query: '{short_query}'")
            news_task2 = asyncio.to_thread(_google_news_search, short_query, num_results)
            wiki_task2 = asyncio.to_thread(_wikipedia_search, short_query)
            news2, wiki2 = await asyncio.gather(news_task2, wiki_task2)
            balanced_results = news2[:half_quota] + wiki2[:num_results - half_quota]
            if len(balanced_results) < num_results:
                remaining_slots = num_results - len(balanced_results)
                balanced_results.extend(news2[half_quota:half_quota + remaining_slots])

    return balanced_results


# NLI Entailment threshold — much stricter than old STS similarity.
# Only sources whose articles genuinely ENTAIL the claim will pass.
MIN_RELEVANCE_THRESHOLD = 0.75

# Label mapping for MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7
# Index 0 = Entailment, Index 1 = Neutral, Index 2 = Contradiction
_NLI_ENTAILMENT_IDX = 0


def _softmax(logits: np.ndarray) -> np.ndarray:
    """Numerically-stable softmax over the last axis."""
    exp = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
    return exp / np.sum(exp, axis=-1, keepdims=True)


def _compute_per_source_similarity(text: str, snippets: list[str]) -> list[float]:
    """
    Compute strict semantic entailment using an NLI Cross-Encoder.

    The model outputs raw logits for [Contradiction, Entailment, Neutral].
    We apply softmax and return the Entailment probability (0.0 → 1.0)
    so that keyword-overlap alone can no longer fool the system.
    """
    model = _get_cross_model()
    if model is None or not snippets:
        return [0.0] * len(snippets)

    try:
        # Cross-Encoders take PAIRS: (premise=article, hypothesis=claim)
        pairs = [[snippet[:512], text[:512]] for snippet in snippets]

        # NLI models return raw logits of shape (N, 3)
        logits = model.predict(pairs)
        logits = np.array(logits)

        # Ensure 2-D even for a single pair
        if logits.ndim == 1:
            logits = logits.reshape(1, -1)

        # Softmax → probabilities, then grab the Entailment column
        probs = _softmax(logits)
        entailment_scores = probs[:, _NLI_ENTAILMENT_IDX]

        return [float(s) for s in entailment_scores]
    except Exception as exc:
        logger.error("NLI entailment computation failed: %s", exc)
        return [0.0] * len(snippets)


async def verify_claim(text: str, search_query: str) -> VerificationResult:
    """
    Search the internet for articles related to *search_query*,
    compute per-source semantic entailment, and discard irrelevant results.
    """
    items = await _search_web(search_query)

    if not items:
        return VerificationResult(similarity_score=0.0, sources=[], verified=False)

    # Build candidate lists
    candidates: list[SourceArticle] = []
    snippets: list[str] = []
    
    # 🔥 THE FIX: Removed the [:8] slice so Wikipedia actually gets processed!
    for item in items:  
        title = item.get("title", "")
        link = item.get("url", "") or item.get("href", "")
        snippet = item.get("body", "")
        
        candidates.append(
            SourceArticle(
                title=title,
                url=link,
                snippet=snippet,
                trust=_trust_level(url=link, snippet=snippet, title=title),
            )
        )
        snippets.append(f"{title}. {snippet}")

    # Compute per-source similarity scores using the new Cross-Encoder
    scores = await asyncio.to_thread(_compute_per_source_similarity, text, snippets)

    # Filter: only keep sources above the relevance threshold
    sources: list[SourceArticle] = []
    relevant_scores: list[float] = []
    
    # 🔎 X-RAY VISION: Print the AI's exact math to the backend terminal
    print("\n" + "="*50)
    print("🧠 CROSS-ENCODER SCORES:")
    
    for candidate, score in zip(candidates, scores):
        print(f"Score: {score:.3f} | Source: {candidate.url}")
        
        # 🏛️ THE WIKIPEDIA VIP PASS 🏛️
        if "wikipedia.org" in candidate.url:
            required_score = 0.45  # Lower bar for encyclopedic context, but high enough to reject noise
        else:
            required_score = MIN_RELEVANCE_THRESHOLD  # 0.75 strict NLI entailment for news
            
        if score >= required_score:
            sources.append(candidate)
            relevant_scores.append(score)
            print(f"  -> ✅ ACCEPTED (Requires >= {required_score})")
        else:
            print(f"  -> ❌ REJECTED (Requires >= {required_score})")
            
    print("="*50 + "\n")

    if not sources:
        return VerificationResult(similarity_score=0.0, sources=[], verified=True)

    avg_similarity = sum(relevant_scores) / len(relevant_scores)

    return VerificationResult(
        similarity_score=round(avg_similarity, 4),
        sources=sources,
        verified=True,
    )