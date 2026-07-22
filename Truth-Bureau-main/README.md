# Truth Bureau (Impetus Project):
Truth Bureau is a real-time OSINT (Open Source Intelligence) fake news detection and fact-checking engine designed to cross-reference unverified claims with live multidimensional internet data.
## At a Glance:
Rather than relying purely on static, pretrained machine-learning "black boxes", Truth Bureau combines a local NLP classifier with **Live Semantic Web Verification**. It actively queries Google News and Wikipedia, audits source credibility, and employs a strict NLI (Natural Language Inference) Cross-Encoder to measure factual entailment between the internet's knowledge and the user's claim.
To train the model public datasets like FakeNewsNet, LIAR, PHEME, WELFake, ISOT, Gen AI Misinformation Datasets were combined and used.
## Key Features:
*   **Hybrid Architecture**: Blends local Machine Learning (Hardware-Accelerated DistilBERT) with real-time web crawlers to detect fresh disinformation instantly.
*   **Military-Grade NLI Entailment**: Uses the `mDeBERTa-v3` Cross-Encoder to guarantee that retrieved articles logically *entail* the claim, ignoring mere keyword correlations.
*   **Source Credibility Audit**: Automatically grades domain authority into High, Medium, and Low trust tiers, granting more weight to established fact-checkers and wire services.
*   **Explainable AI (XAI)**: Visualizes the findings by highlighting clickbait phraseology, mapping confidence breakdowns, and building Origin & Mutation source graphs so end-users understand *why* a verdict was rendered.
*   **Robust Guardrails**: Implements strict logic paradigms, such as the "Zero-Evidence Penalty", instantly flagging completely uncorroborated text as fabricated despite impeccable grammar.
## Pipeline:
### 7-stage pipeline:
Scraper $\rightarrow$ Keywords $\rightarrow$ Receiver $\rightarrow$ Verifier $\rightarrow$ ML Model $\rightarrow$ Decision $\rightarrow$ Sender.
### Dual pipeline:
URL scraping pipeline and direct text/keyword pipeline.
#### Design:

| URL Pipeline                                                                                                                                                                                                                   | Text Pipeline                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Scraper: Fetches URL via newspaper3k / Beautiful Soup<br>2. Keyword Processor: Extracts from scraped title $+$ body.<br>Receiver $\rightarrow$ Verifier $\rightarrow$ ML Model $\rightarrow$ Decision $\rightarrow$ Sender. | Keyword Processor<br>(skips scraper entirely)<br>Receiver $\rightarrow$ Verifier $\rightarrow$ ML Model $\rightarrow$ Decision $\rightarrow$ Sender. |

### Confidence scoring:
Composite of ML + source trust + sentiment (0–100%).
### Explainable AI:
Per-token highlights (clickbait / emotional / hedge / fact indicators).
### Source panel:
5 corroborating sources with trust level and similarity score per source.
## Architecture Highlights:
*   **FastAPI Backend**: Delivers high-speed async processing, efficiently managing concurrent internet requests alongside neural network inferences.
*   **Local NLP Model**: Scores textual structure for sensationalism and emotional manipulation.
*   **Decision Engine**: Synthesizes algorithmic signals into a final weighted confidence score spanning 4 key pillars: ML Syntax Score, Verification Match, Source Credibility, and Linguistic Soundness.
## Use Case:
Truth Bureau represents the next generation of fact-checking applications, engineered not just to flag suspicious syntax, but to prove or disprove factual fabrications by autonomously digging through the real-time internet.
# Installation Process:
### Cloning the Repository:
Run this command:
```bash
git clone https://github.com/nahArnav/Truth-Bureau.git
cd Truth-Bureau
```
## For Windows:
### Create Python Virtual Environment:
Command:
```
cd backend
python -m venv venv
```
### Activate Python Virtual Environment:
Command:
```
venv\Scripts\Activate
```
### Install Python Dependencies:
Command:
```
pip install -r requirements.txt
```
### Training the model:
Command:
```
python train_model.py
```
### Run backend:
Command:
```
uvicorn main:app --reload
```
### Install Frontend Dependencies:
Command:
```
cd ..\frontend
npm install
```
### Run Frontend:
Command:
```
npm run dev
```
## For MacOS:
### Create Python Virtual Environment:
Command:
```
cd backend
python3 -m venv venv
```
### Activate Python Virtual Environment:
Command:
```
source venv/bin/activate
```
### Install Python Dependencies:
Command:
```
pip install -r requirements.txt
```
### Training the model:
Command:
```
python3 train_model.py
```
### Run backend:
Command:
```
uvicorn main:app --reload
```
### Install Frontend Dependencies:
Command:
```
cd ../frontend
npm install
```
### Run Frontend:
Command:
```
npm run dev
```
# Live Demo:
Explore the project here:
[Truth Bureau](https://truthbureau.arnavpatidar.com)