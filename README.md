# Garage Ledger

Garage Ledger is a local workshop management application for tracking vehicles, repairs, parts inventory, service jobs, photos, and business finances in one place.

It is designed for a small garage or vehicle-flipping workflow where every repair and inventory movement should contribute to a clear per-vehicle or per-job profit picture.

![Garage Ledger dashboard](assets/image.png)

## Highlights

- Track cars from purchase through repairs, expenses, sale, and profit calculation.
- Manage parts inventory with separate consumable-part and tool rules.
- Record parts used on cars and service jobs, with automatic stock deductions.
- Create customer service jobs with revenue, labor cost, parts cost, and profit.
- Attach photos to cars and parts, with upload and deletion support.
- View dashboard summaries, recent activity, finance entries, and CSV exports.
- Create on-demand backups and automatic daily backups of the database and uploads.
- Run the complete application locally with a single Windows batch file or a Python command.

## Technology

- **Backend:** Python, FastAPI, SQLModel, SQLite
- **Frontend:** HTML, CSS, and vanilla JavaScript
- **Testing:** pytest, FastAPI `TestClient`, HTTPX
- **Deployment model:** local application served by the FastAPI process

## Requirements

- Python 3.9 or newer
- A modern web browser

## Quick Start

### Windows launcher

Double-click [`Start Garage Ledger.bat`](Start%20Garage%20Ledger.bat). On first launch it installs the Python dependencies, starts the application, and opens the browser when the server is ready.

### Manual setup

From the project root:

```bash
cd backend
python -m pip install -r requirements.txt
cd ..
python -m uvicorn backend.main:app --reload
```

Open [http://127.0.0.1:8000/app/](http://127.0.0.1:8000/app/) in a browser.

The FastAPI documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Demo Data

To populate a new database with sample cars, parts, and service data, run:

```bash
python -m backend.seed_demo
```

The seed script does not overwrite an existing non-empty database.

## Testing

Install the dependencies, then run the test suite from the project root:

```bash
python -m pytest -q
```

The API tests cover:

- Health checks and car CRUD operations
- Parts inventory and stock validation
- Repairs, expenses, and finance ordering
- Service jobs and profit calculation
- Photo upload and file deletion
- Delete and not-found behavior
- Invalid photo extension rejection

## Data and Backups

Runtime data is created automatically and intentionally excluded from Git:

- `backend/garage.db` — SQLite database
- `backend/uploads/` — uploaded car and part photos
- `backend/backups/` — timestamped backup folders

The application attempts one automatic backup per calendar day at startup. Backups include the SQLite database and the uploads directory. The newest 14 backup folders are retained. Backups can also be created and downloaded from the Finances page or through the API.

## API Overview

The backend exposes these route groups:

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Cars | `/api/cars` |
| Repairs and expenses | `/api/cars/{id}/repairs`, `/api/cars/{id}/expenses` |
| Sales and parts usage | `/api/cars/{id}/sale`, `/api/cars/{id}/use-part` |
| Parts inventory | `/api/parts` |
| Service jobs | `/api/services` |
| Photos | `/api/cars/{id}/photos`, `/api/parts/{id}/photos`, `/api/photos/{id}` |
| Finance | `/api/dashboard`, `/api/finances`, `/api/export/csv` |
| Backups | `/api/backups` |

## Project Structure

```text
garage-ledger/
├── backend/
│   ├── main.py              # FastAPI application and startup hooks
│   ├── database.py          # SQLite engine, sessions, and initialization
│   ├── models.py            # SQLModel database models
│   ├── schemas.py           # Request and response schemas
│   ├── backup.py            # Backup creation and retention
│   ├── seed_demo.py         # Optional demo data
│   └── routers/             # Cars, parts, services, photos, finance, backups
├── frontend/
│   ├── index.html
│   ├── css/                 # Application styling
│   └── js/                  # Dashboard and feature modules
├── tests/
│   └── test_api.py          # API regression tests
├── assets/                  # README and application assets
└── Start Garage Ledger.bat  # Windows setup and launcher
```

## Design Notes

- SQLite keeps the application simple to install and suitable for a single local user.
- Database sessions are injected into API routes through FastAPI dependencies.
- Tests use temporary SQLite databases and temporary upload directories, so test runs do not modify real garage data.
- When a consumable part is used, its stock decreases; deleting that usage restores the stock.
- Tools cannot be consumed as vehicle or service-job parts.
- Vehicle cost combines purchase price, repairs, expenses, and consumed parts.
- Service-job profit is calculated from the job price minus labor and consumed-part costs.

## Security and Scope

Garage Ledger is intended for trusted local use. It does not currently provide user authentication or authorization, and the API enables permissive CORS for the local frontend.

