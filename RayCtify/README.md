<div align="center">

# ⚖️ RayCtify

### *Achieving Algorithmic Equilibrium*

**The institutional-grade AI auditing framework for detecting, neutralizing, and evaluating demographic bias in financial loan approval models.**

[![License: Enterprise](https://img.shields.io/badge/License-Enterprise-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white)](https://vitejs.dev/)
[![GCP](https://img.shields.io/badge/Deploy-Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Firebase](https://img.shields.io/badge/Host-Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Zero Retention](https://img.shields.io/badge/Data%20Policy-Zero%20Retention-success)](SECURITY.md)

</div>

---

## 🔭 Overview

Modern financial AI systems routinely encode demographic bias — not through overt discrimination, but through **proxy variables**: features that silently correlate with race, gender, or national origin. RayCtify was engineered to break that chain.

RayCtify is a **full-scale Algorithmic Equilibrium Suite** that wraps black-box machine learning models in a transparent *Glass Box* proxy. It forces your loan approval AI to evaluate applicants based exclusively on standardized, legally defensible financial metrics — and then proves it, mathematically.

> *"RayCtify doesn't just flag bias. It diagnoses it, heals it, stress-tests it, establishes a ground-truth baseline against it, and trains future models to never repeat it."*

### What Makes RayCtify Different

Unlike point-solution fairness checkers, RayCtify operates across a **five-pillar lifecycle** — from raw model ingestion all the way to adversarial dataset generation for future model training. Every stage is traceable, auditor-ready, and built for enterprise deployment with zero data retention.

---

## 🏛️ The 5-Pillar Architecture

### Pillar I — 🔬 The Interceptor *(Model Healing)*

The entry point of the RayCtify pipeline. The Interceptor ingests serialized institutional models in `.pkl`, `.onnx`, and `.pmml` formats via a secure deserialization layer, with no data written to disk at any stage.

**What it does:**

- Maps the full feature schema of the ingested model
- Detects sensitive demographic parameters (race, gender, zip code proxies, national origin, etc.)
- Wraps the original model in the `RayCtifiedWrapper` — a transparent proxy layer
- Mathematically **zeroes out the weights** of all identified illegal proxy variables
- Exports the "healed" model in a clean, auditable format

The result is a production-ready model that has been surgically corrected, with a full audit trail of exactly which parameters were neutralized and why.

---

### Pillar II — 🔍 The Model Auditor *(Granular Introspection)*

Designed for **single-applicant micro-analysis**, the Model Auditor gives compliance officers and data scientists an unambiguous view into exactly how the AI reached its decision.

**Key capabilities:**

- **High-Precision Normalization** — Dynamically extracts the internal coefficients of the model and forces them into a perfect 100% relative influence breakdown, so every factor's contribution is immediately legible.
- **True-Sign Preservation** — Accurately renders the push/pull polarity of each decision factor. An auditor can see, for example, that `DTI` dragged the approval score down (−) while `income_to_debt_ratio` pushed it up (+), cleanly separating financial reality from demographic noise.
- **Demographic Isolation** — Highlights the exact delta between what the base model would have scored and what the RayCtified model scores for the same applicant.

---

### Pillar III — ⚔️ The Arena *(Batch Stress Testing)*

Where individual auditing ends, institutional-scale evaluation begins. The Arena evaluates hundreds of applicant records **simultaneously**, pitting the original biased model directly against its RayCtified counterpart.

**Key capabilities:**

- Ingests bulk applicant datasets and runs parallel inference on both models
- Calculates an explicit **"Bias Penalty" delta score** for each applicant — a precise, numerical representation of how much the base model artificially suppressed approval probability for that individual
- Aggregates results by demographic cohort, generating the kind of statistically rigorous output that satisfies CFPB, OCC, and internal legal review
- Provides side-by-side approval rate comparisons that are Wall Street presentation-ready

---

### Pillar IV — 📐 The Reference Model *(Ground Truth Baseline)*

Because even a RayCtified AI model can drift in subtle, unpredictable ways, RayCtify includes a mathematically pristine **Reference Engine** built on the `REFERENCE_MODEL_SCHEMA`.

This schema explicitly excludes all demographic variables and uses only **9 pristine financial factors** (credit score, income, DTI, employment history, and related signals) to produce a classical, rules-based loan scoring output.

**Why this matters:**

The Reference Model answers the auditor's most fundamental question: *"What would a standard, purely mathematical banking formula say about this applicant?"* Any significant deviation between the AI's output and the Reference Model's output is a quantified signal of **algorithmic drift** — the kind of unexplained divergence that regulators flag during examination.

---

### Pillar V — 💉 The Vaccine *(Adversarial Dataset Generation)*

The Vaccine generator closes the loop on the entire auditing lifecycle. Once a model's vulnerabilities have been fully exposed through Pillars I–IV, the Vaccine creates the cure.

**What it generates:**

- **Demographically Neutralized Batches** — Synthetic datasets where sensitive attributes are balanced and de-correlated from financial outcomes, suitable for retraining
- **Adversarial Edge Cases** — Deliberately crafted applicant profiles designed to probe and stress-test model boundaries, exposing latent proxy dependencies before they reach production
- **Safe Augmentation Sets** — Clean, policy-compliant datasets ready to be fed back to data-science teams as training signal

The Vaccine effectively **inoculates future models** against proxy bias before they are ever trained, breaking the cycle at the source.

---

## 🛡️ Enterprise Features

### Institutional Guardrails

RayCtify enforces hard, non-negotiable banking policies through vectorized Pandas logic that intercepts the prediction pipeline before output is returned. These guardrails operate safely across large batch jobs with no performance penalty.

- Automatically rejects any applicant with a credit score below **500** (deep subprime threshold), regardless of the AI model's computed probability
- Configurable policy thresholds map to internal credit policy documents, providing a clear audit chain between code and compliance documentation

### Standardized Telemetry

To ensure outputs are compatible with regulatory submissions and internal risk dashboards:

- DTI is standardized as `dti_ratio` with a **20% baseline weight**, enforced across all scoring computations
- All feature names are normalized to an industry-standard schema before any inference is run, guaranteeing consistent reporting across model versions and vendors

### Zero-Retention In-Memory Processing

No institutional IP or personally identifiable information (PII) is ever written to disk, logged to application storage, or retained in any server-side cache. All processing occurs entirely in-memory within ephemeral Cloud Run containers that are destroyed after each request. See the [Security Policy](#-security--data-privacy) for full details.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│         React (Vite) · Tailwind CSS · Framer Motion             │
│                    Firebase Hosting (CDN)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────────────────┐
│                        API LAYER                                │
│              FastAPI · Python 3.11 · Pydantic v2                │
│              Google Cloud Run (Ephemeral Containers)            │
└──┬──────────┬────────────┬───────────────┬──────────────────────┘
   │          │            │               │
   ▼          ▼            ▼               ▼
Pillar I   Pillar II   Pillar III      Pillar IV     Pillar V
Interceptor  Auditor     Arena        Reference      Vaccine
  (.pkl/      (Single    (Batch        (Ground        (Adversarial
  .onnx/      Applicant  Stress        Truth          Generator)
  .pmml)      Analysis)  Testing)      Baseline)
   │          │            │               │               │
   └──────────┴────────────┴───────────────┴───────────────┘
                           │
              ┌────────────▼────────────┐
              │   Scikit-Learn · Pandas  │
              │   NumPy · In-Memory Only │
              └─────────────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 (Vite) |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **Frontend Hosting** | Firebase Hosting |
| **Backend Language** | Python 3.11 |
| **API Framework** | FastAPI |
| **ML Runtime** | Scikit-Learn |
| **Data Processing** | Pandas, NumPy |
| **Cloud Runtime** | Google Cloud Run |
| **Serialization Support** | `.pkl`, `.onnx`, `.pmml` |

---

## ⚙️ Local Setup

### Prerequisites

Before running RayCtify locally, ensure the following are installed:

- Python 3.11+
- Node.js 18+ and npm
- Google Cloud SDK (for deployment)
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Clone the Repository

```bash
git clone https://github.com/nahArnav/RayCtify.git
cd rayctify
```

### 2. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive documentation is served at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
# Navigate to the frontend directory
cd ../frontend

# Install dependencies
npm install

# Copy the environment template and configure your API URL
cp .env.example .env.local
# Edit .env.local → set VITE_API_BASE_URL=http://localhost:8000

# Start the Vite development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## 🚀 Deployment

### Backend — Google Cloud Run

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build and push the Docker image to Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/rayctify-api

# Deploy to Cloud Run (ephemeral, zero-retention configuration)
gcloud run deploy rayctify-api \
  --image gcr.io/YOUR_PROJECT_ID/rayctify-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --concurrency 80 \
  --max-instances 10 \
  --no-allow-unauthenticated   # Remove for public access
```

> **Note:** Cloud Run containers are stateless and ephemeral by design. No volume mounts or persistent storage are configured, enforcing the zero-retention security policy at the infrastructure level.

### Frontend — Firebase Hosting

```bash
# Navigate to the frontend directory
cd frontend

# Build the production bundle
npm run build

# Authenticate with Firebase
firebase login

# Initialize Firebase in the project (first time only)
firebase init hosting

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 🔒 Security & Data Privacy

RayCtify was engineered from the ground up with institutional data governance requirements in mind.

### Zero-Retention In-Memory Processing

All model artifacts, applicant records, and inference outputs are processed **exclusively in the memory of ephemeral Google Cloud Run containers**. Specifically:

- No model files (`.pkl`, `.onnx`, `.pmml`) are written to disk or persisted in cloud storage
- No applicant PII (names, SSNs, addresses, demographic attributes) is logged, stored, or transmitted to any third-party service
- Each Cloud Run container instance is destroyed after completing its request lifecycle, leaving no residual data
- Application logs are scoped to operational telemetry only (latency, status codes) and contain no user or model data

### Institutional IP Protection

Uploaded model files represent proprietary intellectual property. RayCtify's architecture ensures that:

- Model weights and architecture details are **never retained** beyond the duration of a single API request
- The `RayCtifiedWrapper` outputs a healed model for client download; no copy is stored server-side
- All inter-service communication is encrypted in transit via TLS 1.3

### Compliance Posture

RayCtify's design is aligned with the requirements of the **Equal Credit Opportunity Act (ECOA)**, **Fair Housing Act (FHA)**, and **CFPB supervisory guidance** on algorithmic fairness. The Bias Penalty reports generated by The Arena are structured to support regulatory examination responses.

---

## 📂 Repository Structure

```
rayctify/
├── backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── interceptor/             # Pillar I — Model healing logic
│   ├── auditor/                 # Pillar II — Single-applicant introspection
│   ├── arena/                   # Pillar III — Batch stress testing
│   ├── reference_model/         # Pillar IV — Ground truth baseline engine
│   ├── vaccine/                 # Pillar V — Adversarial dataset generation
│   ├── guardrails/              # Institutional policy enforcement
│   ├── schemas/                 # Pydantic request/response schemas
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # React UI components
│   │   ├── pages/               # Route-level page components
│   │   └── api/                 # API client layer
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── .github/
│   └── workflows/               # CI/CD pipelines
├── firebase.json
└── README.md
```

---

## 📄 License

This project is licensed under the RayCtify Enterprise License. See `LICENSE` for full terms.

---

<div align="center">

**Built to make algorithmic fairness the default, not the exception.**

*RayCtify — Achieving Algorithmic Equilibrium*

</div>
