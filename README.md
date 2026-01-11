<div align="center">

# 🛡️ Smart SIEM

### ML-Enhanced Security Information and Event Management System

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![LightGBM](https://img.shields.io/badge/LightGBM-4.0-02569B?logo=python&logoColor=white)](https://lightgbm.readthedocs.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A modern, intelligent Security Information and Event Management (SIEM) system that integrates **Machine Learning** to automatically classify security alerts, detect threats, and provide real-time security monitoring with a beautiful React-based dashboard.

[Features](#-features) • [Architecture](#-architecture) • [Installation](#-installation) • [Usage](#-usage) • [API Reference](#-api-reference) • [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [ML Model Details](#-ml-model-details)
- [Frontend Components](#-frontend-components)
- [Configuration](#-configuration)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

**Smart SIEM** is a comprehensive security monitoring platform designed to work with [Wazuh](https://wazuh.com/) security alerts. It combines traditional SIEM capabilities with modern Machine Learning to provide:

- **Automated Threat Detection**: ML models analyze incoming alerts and predict their malicious potential
- **Real-time Dashboard**: Beautiful, responsive UI for monitoring security events
- **Human-in-the-Loop**: Security analysts can review and correct ML predictions to continuously improve the model
- **Model Versioning**: Track model performance over time with version control and rollback capabilities
- **Scheduled Retraining**: Automatically retrain models with new labeled data

### Why Smart SIEM?

Traditional SIEM systems generate thousands of alerts daily, overwhelming security teams. Smart SIEM uses Machine Learning to:

1. **Prioritize alerts** based on threat probability scores
2. **Auto-classify** high-confidence malicious alerts
3. **Learn from analyst feedback** to improve over time
4. **Reduce false positives** through continuous model refinement

---

## ✨ Features

### 🎯 Core Features

| Feature | Description |
|---------|-------------|
| **Real-time Alert Monitoring** | View, filter, and search security alerts in real-time |
| **ML-Powered Classification** | Automatic threat scoring using LightGBM classifier |
| **Interactive Dashboard** | Modern React UI with threat level summaries |
| **Analyst Feedback Loop** | Mark alerts as malicious/safe to improve ML model |
| **Model Versioning** | Track, compare, and rollback ML model versions |
| **Scheduled Retraining** | Automatic model retraining based on new data |
| **REST API** | Complete API for integration with Wazuh and other tools |

### 📊 Dashboard Features

- **Security Dashboard**: Overview of all alerts with filtering and sorting
- **ML Feedback Page**: Review model predictions and provide corrections
- **Alerts Page**: Active security alerts with acknowledgment workflow
- **Settings Page**: Configure ML model parameters and view model versions

### 🤖 ML Capabilities

- **Multi-feature Classification**: Uses agent info, rule details, timestamps, and more
- **Confidence Scores**: 0-10 scale for easy threat prioritization
- **Auto-Classification**: Optionally auto-classify high-confidence alerts
- **Real-time Evaluation**: Compare model predictions against human labels
- **Model Performance Metrics**: Accuracy, Precision, Recall, F1 Score

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Smart SIEM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   Wazuh Agent    │───▶│  FastAPI Backend │◀───│  React Frontend  │   │
│  │   (Alerts)       │    │  (Python)        │    │  (TypeScript)    │   │
│  └──────────────────┘    └────────┬─────────┘    └──────────────────┘   │
│                                   │                                      │
│                          ┌────────▼─────────┐                           │
│                          │                  │                           │
│             ┌────────────┤    MongoDB       ├────────────┐              │
│             │            │                  │            │              │
│             │            └──────────────────┘            │              │
│             │                                            │              │
│      ┌──────▼──────┐    ┌──────────────┐    ┌───────────▼───────┐      │
│      │   alerts    │    │  malicious   │    │      safe         │      │
│      │ collection  │    │  collection  │    │   collection      │      │
│      └─────────────┘    └──────────────┘    └───────────────────┘      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     ML Pipeline                                   │   │
│  │  ┌─────────────┐   ┌────────────┐   ┌───────────┐   ┌─────────┐  │   │
│  │  │  Feature    │──▶│  LightGBM  │──▶│ Prediction│──▶│ Version │  │   │
│  │  │ Extraction  │   │  Classifier│   │   API     │   │ Control │  │   │
│  │  └─────────────┘   └────────────┘   └───────────┘   └─────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Alert Ingestion**: Wazuh sends alerts to `/events` endpoint
2. **Storage**: Alerts stored in MongoDB with normalized timestamps
3. **ML Prediction**: Each alert is classified using the LightGBM model
4. **Display**: React frontend fetches and displays alerts with predictions
5. **Feedback**: Analysts classify alerts, data stored in `malicious`/`safe` collections
6. **Retraining**: Scheduler periodically retrains model with new labeled data

---

## 🛠 Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI Framework |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first CSS framework |
| **Radix UI** | Accessible UI primitives |
| **Recharts** | Charts and visualizations |
| **Lucide React** | Beautiful icons |

### Backend

| Technology | Purpose |
|------------|---------|
| **FastAPI** | High-performance API framework |
| **Python 3.11+** | Backend language |
| **Motor** | Async MongoDB driver |
| **LightGBM** | Gradient boosting ML framework |
| **scikit-learn** | ML pipeline and preprocessing |
| **APScheduler** | Background job scheduling |
| **Joblib** | Model serialization |

### Database & Infrastructure

| Technology | Purpose |
|------------|---------|
| **MongoDB 7** | Document database for alerts |
| **Docker** | Container deployment |
| **Docker Compose** | Multi-container orchestration |

---

## 📁 Project Structure

```
Smart_SIEM/
├── 📂 backend/                    # Python FastAPI Backend
│   ├── app.py                     # Main FastAPI application
│   ├── db.py                      # MongoDB operations
│   ├── features.py                # ML feature extraction
│   ├── model_wrapper.py           # ML model wrapper class
│   ├── trainer.py                 # Model training logic
│   ├── scheduler.py               # Background job scheduler
│   ├── backfill.py                # Batch prediction backfill
│   ├── model_versioning.py        # Model version control
│   ├── requirements.txt           # Python dependencies
│   ├── docker-compose.yml         # MongoDB container config
│   └── 📂 models/                 # Trained model storage
│
├── 📂 src/                        # React Frontend
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # Application entry point
│   ├── 📂 components/             # React components
│   │   ├── Dashboard.tsx          # Security logs dashboard
│   │   ├── MLFeedback.tsx         # ML feedback interface
│   │   ├── Alerts.tsx             # Active alerts page
│   │   ├── Settings.tsx           # Configuration page
│   │   └── 📂 ui/                 # Reusable UI components
│   ├── 📂 services/               # API service layer
│   │   └── api.tsx                # Backend API client
│   ├── 📂 types/                  # TypeScript type definitions
│   │   └── index.ts               # Shared types
│   └── 📂 styles/                 # CSS styles
│
├── 📂 models/                     # ML model files
│   ├── final_model.py             # Training script
│   ├── lightgbm.ipynb             # Jupyter notebook for training
│   └── current.joblib             # Production model
│
├── 📂 dataset/                    # Training data generators
│   ├── gen_benign_auth.py         # Generate benign alerts
│   └── gen_malic_auth.py          # Generate malicious alerts
│
├── package.json                   # Frontend dependencies
├── vite.config.ts                 # Vite configuration
└── README.md                      # This file
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Docker** and Docker Compose
- **Git**

### Quick Start

#### 1. Clone the Repository

```bash
git clone https://github.com/space-techy/Smart_SIEM.git
cd Smart_SIEM
```

#### 2. Start MongoDB

```bash
cd backend
docker compose up -d
```

This starts MongoDB on port 27017 with persistent storage.

#### 3. Setup Backend

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

The backend will be available at `http://localhost:8081`

#### 4. Setup Frontend

```bash
# From project root
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Docker Deployment (Optional)

For production deployment, see the [backend README](./backend/README.md) for Docker configuration details.

---

## 📖 Usage

### Sending Alerts to Smart SIEM

Smart SIEM receives alerts via POST requests to the `/events` endpoint:

```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-01-11T10:30:00.000+0000",
    "rule": {
      "level": 7,
      "description": "SSH brute force attempt detected",
      "id": "5710",
      "groups": ["authentication_failure", "sshd"]
    },
    "agent": {
      "id": "001",
      "name": "web-server-01",
      "ip": "192.168.1.100"
    },
    "full_log": "Jan 11 10:30:00 web-server-01 sshd[12345]: Failed password for root"
  }'
```

### Dashboard Navigation

The UI has four main sections accessible via the sidebar:

1. **Dashboard** (`#dashboard`) - View and filter all security logs
2. **ML Feedback** (`#ml-feedback`) - Review ML predictions and provide feedback
3. **Alerts** (`#alerts`) - Manage active security alerts
4. **Settings** (`#settings`) - Configure ML model and view versions

### Classifying Alerts

1. Navigate to the **Dashboard** or **ML Feedback** page
2. Find an alert you want to classify
3. Click **"Mark Malicious"** or **"Mark Safe"**
4. The classification is saved and used for model retraining

### Viewing ML Performance

1. Go to **ML Feedback** page
2. View real-time accuracy metrics calculated from MongoDB
3. Click **Refresh** to update metrics after new classifications

### Model Management

1. Go to **Settings** → **ML Model** tab
2. View current model version and performance
3. **Trigger Training Now** to manually retrain
4. **Rollback** to previous versions if needed

---

## 📡 API Reference

### Authentication

All protected endpoints require Bearer token authentication:

```
Authorization: Bearer <BACKEND_KEY>
```

Default development key: `devkey`

### Endpoints

#### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/events` | Receive and store Wazuh alerts |
| `GET` | `/api/alerts` | List all alerts with pagination |
| `GET` | `/api/alerts/count` | Get total alert count |
| `POST` | `/classify` | Classify an alert as malicious/safe |
| `GET` | `/classify/{id}` | Get classification for an alert |

#### ML Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/ml/status` | Get ML system status |
| `GET` | `/ml/evaluate` | Evaluate model on labeled data |
| `POST` | `/ml/train` | Trigger model retraining |
| `POST` | `/ml/backfill` | Backfill predictions for existing alerts |
| `POST` | `/ml/reload` | Reload ML model |
| `GET` | `/ml/versions` | List all model versions |
| `POST` | `/ml/rollback` | Rollback to a previous model version |

#### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get ML settings |
| `PUT` | `/api/settings` | Update ML settings |

#### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Home endpoint |
| `GET` | `/health` | Health check |

### Example: Evaluate Model

```bash
curl -X GET http://localhost:8081/ml/evaluate \
  -H "Authorization: Bearer devkey"
```

Response:
```json
{
  "ok": true,
  "evaluated": 150,
  "metrics": {
    "accuracy": 0.92,
    "precision": 0.89,
    "recall": 0.94,
    "f1_score": 0.91
  },
  "message": "Evaluated 150 alerts with both predictions and labels"
}
```

---

## 🤖 ML Model Details

### Feature Engineering

The ML model extracts the following features from Wazuh alerts:

| Feature | Type | Description |
|---------|------|-------------|
| `agent_name` | Categorical | Name of the reporting agent |
| `srcuser` | Categorical | Source username (if available) |
| `decoder_name` | Categorical | Wazuh decoder used |
| `program_name` | Categorical | Program that generated the log |
| `rule_groups` | Categorical | Semicolon-separated rule groups |
| `rule_level` | Numerical | Alert severity level (0-15) |
| `hour_of_day` | Numerical | Hour when alert occurred (0-23) |
| `day_of_week` | Numerical | Day of week (0=Monday, 6=Sunday) |
| `success` | Numerical | 1 if authentication success, else 0 |

### Model Pipeline

```python
Pipeline([
    ('preprocessor', ColumnTransformer([
        ('num', StandardScaler(), numerical_features),
        ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
    ])),
    ('classifier', LGBMClassifier(
        n_estimators=100,
        learning_rate=0.1,
        num_leaves=40,
        max_depth=10
    ))
])
```

### Training Process

1. Load labeled data from `malicious` and `safe` collections
2. Extract features using `features.py`
3. Split into train/test sets (80/20)
4. Train LightGBM classifier
5. Evaluate on test set
6. If F1 score improves by > 2%, promote to production
7. Save version with metrics to `models/versions/`

### Model Versioning

Models are versioned with timestamps (e.g., `model-20250111-143000.joblib`) and tracked in `models/versions.json`. The production model is always at `models/current.joblib`.

---

## 🎨 Frontend Components

### Dashboard (`Dashboard.tsx`)

The main security log viewer with:
- Threat level summary cards (High/Moderate/Low)
- Searchable, filterable log table
- Multi-column sorting (Level, ML Score, Timestamp)
- Log detail dialog
- Classification buttons

### ML Feedback (`MLFeedback.tsx`)

Human-in-the-loop interface featuring:
- Real-time accuracy metrics from MongoDB
- Detailed ML performance cards (Accuracy, Precision, Recall, F1)
- Logs requiring review table
- Pending feedback queue
- Correction workflow

### Alerts (`Alerts.tsx`)

Active alert management with:
- Alert severity summary
- Active/Acknowledged alert lists
- Acknowledge and Ignore actions
- Link to related log entry

### Settings (`Settings.tsx`)

Configuration interface including:
- Retraining interval configuration
- Confidence threshold setting
- Auto-classification toggle
- Manual training trigger
- Model version history with rollback

---

## ⚙️ Configuration

### Environment Variables

#### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_KEY` | `devkey` | API authentication token |
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `PORT` | `8081` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `PRINT_FULL_JSON` | `false` | Log full alert JSON |

#### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8081` | Backend API URL |

### ML Settings (via API/UI)

| Setting | Default | Description |
|---------|---------|-------------|
| `retrain_interval_value` | `24` | Retraining interval value |
| `retrain_interval_unit` | `hours` | Interval unit (minutes/hours) |
| `confidence_threshold` | `0.85` | Auto-classify threshold |
| `auto_classify` | `false` | Enable auto-classification |
| `scheduler_enabled` | `true` | Enable scheduled retraining |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- **Frontend**: Follow existing TypeScript/React patterns
- **Backend**: Follow PEP 8 Python style guide
- **Commits**: Use conventional commit messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Wazuh](https://wazuh.com/) - Open source security monitoring
- [LightGBM](https://lightgbm.readthedocs.io/) - Gradient boosting framework
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Radix UI](https://www.radix-ui.com/) - Accessible React components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

<div align="center">

**Built with ❤️ for the security community**

[⬆ Back to Top](#-smart-siem)

</div>
