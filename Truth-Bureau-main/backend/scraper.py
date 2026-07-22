"""
Web Scraper for Truth Bureau (V2 - Trafilatura Engine)
Uses the modern trafilatura library to bypass bot-blockers,
strip out cookie banners, and extract pristine article text for NLP.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import trafilatura

logger = logging.getLogger(__name__)


@dataclass
class ScrapedArticle:
    title: str
    text: str
    authors: list[str]
    publish_date: str | None
    source_url: str


def extract_article(url: str) -> ScrapedArticle:
    """
    Download and parse a news article from *url* using Trafilatura.
    Raises ValueError on failure or if the site aggressively blocks scraping.
    """
    logger.info(f"Attempting to scrape URL: {url}")
    
    # 1. Fetch the raw HTML (Trafilatura handles redirects and headers automatically)
    downloaded = trafilatura.fetch_url(url)
    
    if downloaded is None:
        logger.error(f"Fetch failed for {url}. The site may be down or actively blocking bots.")
        raise ValueError("Could not access URL. The site may be blocking automated requests or is invalid.")

    # 2. Extract the text and metadata (bare_extraction returns a dictionary)
    # We disable comments and tables to keep the text as pure as possible for the AI.
    extracted = trafilatura.bare_extraction(
        downloaded, 
        include_comments=False, 
        include_tables=False
    )

    # 3. Guardrail: Did we actually get text?
    if extracted is None or not extracted.get('text') or len(extracted.get('text', '').strip()) < 50:
        logger.warning(f"Extraction failed or returned too little text for {url}")
        raise ValueError(
            "Extracted article content is too short or empty. "
            "The URL may be a video, a paywalled article, or heavily obfuscated with JavaScript."
        )

    # 4. Clean up the metadata
    title = extracted.get('title') or "Unknown Title"
    text = extracted.get('text', '')
    date = extracted.get('date')
    
    # Trafilatura usually returns authors as a single string separated by semicolons or commas
    raw_author = extracted.get('author')
    if raw_author:
        # Split by comma or semicolon and clean up whitespace
        authors = [a.strip() for a in raw_author.replace(';', ',').split(',') if a.strip()]
    else:
        authors = []

    logger.info(f"Successfully scraped: '{title[:30]}...' ({len(text)} characters)")

    return ScrapedArticle(
        title=title,
        text=text,
        authors=authors,
        publish_date=date,
        source_url=url,
    )