"""
NLP Utilities for Truth Bureau
- Text preprocessing (lowercasing, stopword removal, tokenization)
- Keyword extraction for search queries
- Suspicious phrase detection
- Language detection (English / Hindi)
"""

import re
import string

# ── stopwords (lightweight, no NLTK download needed) ────────────────────────
ENGLISH_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "because", "but", "and", "or", "if", "while", "about", "up", "its",
    "it", "he", "she", "they", "we", "you", "i", "me", "him", "her",
    "us", "them", "my", "your", "his", "our", "their", "this", "that",
    "these", "those", "what", "which", "who", "whom", "s", "t", "don",
    "didn", "doesn", "hadn", "hasn", "haven", "isn", "wasn", "weren",
    "won", "wouldn", "couldn", "shouldn", "ain", "aren", "re", "ve", "ll",
}

# ── suspicious / clickbait phrases ──────────────────────────────────────────
CLICKBAIT_PHRASES = [
    "you won't believe",
    "shocking",
    "breaking",
    "exposed",
    "secret",
    "they don't want you to know",
    "what they're hiding",
    "mind-blowing",
    "jaw-dropping",
    "unbelievable",
    "gone wrong",
    "doctors hate",
    "one weird trick",
    "this will change everything",
    "spread this before it's deleted",
    "mainstream media won't tell you",
    "exposed the truth",
    "wake up",
    "big pharma",
    "conspiracy",
    "cover-up",
    "coverup",
    "bombshell",
    "urgent",
    "must watch",
    "must read",
    "share before it's too late",
    "banned",
    "censored",
]

EMOTIONAL_PHRASES = [
    "absolutely",
    "totally",
    "completely",
    "utterly",
    "extremely",
    "terrifying",
    "horrifying",
    "devastating",
    "outrageous",
    "disgusting",
    "insane",
    "crazy",
    "incredible",
    "miraculous",
    "phenomenal",
    "unprecedented",
    "never before seen",
    "the truth about",
    "exposed",
    "the real story",
]

UNSUPPORTED_CLAIM_MARKERS = [
    "sources say",
    "experts believe",
    "studies show",
    "according to sources",
    "rumor has it",
    "allegedly",
    "it is believed",
    "some people say",
    "many believe",
    "reports suggest",
    "anonymous sources",
    "unnamed officials",
    "insiders reveal",
]

# ── Hindi character range for language detection ────────────────────────────
HINDI_PATTERN = re.compile(r"[\u0900-\u097F]")


def preprocess_text(text: str) -> str:
    """Lowercase, remove punctuation, remove stopwords."""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    tokens = text.split()
    tokens = [t for t in tokens if t not in ENGLISH_STOPWORDS]
    return " ".join(tokens)


def extract_keywords(text: str, top_n: int = 10) -> list[str]:
    """Return the most frequent non-stopword tokens."""
    cleaned = preprocess_text(text)
    tokens = cleaned.split()
    freq: dict[str, int] = {}
    for t in tokens:
        if len(t) > 2:
            freq[t] = freq.get(t, 0) + 1
    sorted_tokens = sorted(freq, key=freq.get, reverse=True)  # type: ignore
    return sorted_tokens[:top_n]



import re

import re

def build_search_query(text: str) -> str:
    """
    Strips conversational filler, internet slang, and extracts the core claim for a laser-focused web search.
    """
    # 1. Massive list of conversational filler, clickbait, and Gen Z slang phrases
    fillers = [
        # News/WhatsApp filler
        "is it true that", "i heard that", "someone told me", "can you check if",
        "they are saying", "breaking news", "shocking", "whatsapp forward",
        "forwarded as received", "please verify", "pls verify", "can you verify",
        "fact check this", "tell me if", "did you hear", "rumor has it",
        "watch till the end", "viral video", "secret exposed", "must watch",
        "mind blowing", "i read somewhere", "is this real", "is this fake",
        "check this news", "verify this claim", "you won't believe",
        "alert:", "warning:", "urgent:", "fwd:", "bro is it true", "bhau tell me",
        
        # Gen Z / Internet Slang Phrases
        "no cap", "fr fr", "on god", "spill the tea", "is it giving", 
        "big yikes", "to be honest", "not gonna lie", "out of pocket",
        "let him cook", "make it make sense", "rent free", "touch grass",
        "caught in 4k", "main character energy", "pop off", "periodt",
        "for real", "deadass", "lowkey", "highkey", "tbh", "ngl", "chat is this real",
        "make it viral"
    ]
    
    clean_text = text.lower()
    for filler in fillers:
        clean_text = clean_text.replace(filler, " ")
        
    # 2. Keep only alphanumeric words
    words = re.findall(r'\b\w+\b', clean_text)
    
    # 3. Comprehensive English Stop Words + Gen Z "Brainrot" Dictionary
    stop_words = {
        # Standard English NLP Stop Words
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", 
        "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", 
        "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", 
        "theirs", "themselves", "what", "which", "who", "whom", "this", "that", 
        "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", 
        "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", 
        "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", 
        "at", "by", "for", "with", "about", "against", "between", "into", "through", 
        "during", "before", "after", "above", "below", "to", "from", "up", "down", 
        "in", "out", "on", "off", "over", "under", "again", "further", "then", 
        "once", "here", "there", "when", "where", "why", "how", "all", "any", 
        "both", "each", "few", "more", "most", "other", "some", "such", "no", 
        "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", 
        "t", "can", "will", "just", "don", "should", "now", "d", "ll", "m", "o", 
        "re", "ve", "y", "ain", "aren", "couldn", "didn", "doesn", "hadn", "hasn", 
        "haven", "isn", "ma", "mightn", "mustn", "needn", "shan", "shouldn", 
        "wasn", "weren", "won", "wouldn", "tell", "know", "think", "believe", 
        "say", "said", "saying", "ask", "asked", "check", "news", "today", "new",
        
        # Gen Z / Internet Slang Single Words
        "fr", "cap", "bruh", "bro", "dude", "rn", "skibidi", "rizz", "sigma", 
        "bet", "af", "smh", "idk", "idc", "lmao", "lmfao", "lol", "rofl", "omg",
        "sus", "legit", "bussin", "yall", "based", "cringe", "ratio", "gyatt",
        "mewing", "lit", "fire", "tea", "dub", "flop", "iykyk", "literally", 
        "actually", "basically", "seriously", "like", "yap", "yapping", 
        "delulu", "solulu", "pookie", "aura", "chat", "fyi", "lmk", "tldr"
    }
    
    # Filter out the stop words and slang
    core_keywords = [word for word in words if word not in stop_words]
    
    # 4. Limit to top 8 keywords so Google News doesn't get overwhelmed
    final_query = " ".join(core_keywords[:8])
    
    # Fallback just in case they typed nothing but slang/stop words
    return final_query if final_query.strip() else text[:50]


def detect_language(text: str) -> str:
    """Detect if text is primarily Hindi or English."""
    hindi_chars = len(HINDI_PATTERN.findall(text))
    total_alpha = sum(1 for c in text if c.isalpha())
    if total_alpha == 0:
        return "en"
    if hindi_chars / total_alpha > 0.3:
        return "hi"
    return "en"


def detect_suspicious_phrases(text: str) -> dict:
    """Scan text for clickbait, emotional, and unsupported-claim markers."""
    lower = text.lower()
    found_clickbait = [p for p in CLICKBAIT_PHRASES if p in lower]
    found_emotional = [p for p in EMOTIONAL_PHRASES if p in lower]
    found_unsupported = [p for p in UNSUPPORTED_CLAIM_MARKERS if p in lower]
    total = len(found_clickbait) + len(found_emotional) + len(found_unsupported)
    return {
        "clickbait_phrases": found_clickbait,
        "emotional_language": found_emotional,
        "unsupported_claims": found_unsupported,
        "total_suspicious_count": total,
    }


def tokenize(text: str) -> list[str]:
    """Simple whitespace + punctuation tokenizer."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return text.split()
