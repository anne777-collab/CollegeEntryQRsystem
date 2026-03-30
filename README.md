# QR-Based College Entry System

A FastAPI + SQLite web application for student registration, QR code generation, gate scanning, and admin monitoring during college events.

## Features

- Student registration with unique roll number validation
- Token-only QR code generation using the `qrcode` library
- Single-use entry verification in real time
- Mobile-friendly scanner page using `html5-qrcode`
- Admin panel with search, filter, and timestamp visibility

## Project Structure

```text
project/
|-- backend/
|   |-- __init__.py
|   |-- database.py
|   |-- main.py
|   |-- models.py
|   |-- schemas.py
|   |-- utils.py
|-- frontend/
|   |-- admin.html
|   |-- index.html
|   |-- scanner.html
|   |-- script.js
|   |-- style.css
|-- qr_codes/
|-- database.db
|-- requirements.txt
```

## Setup

1. Install Python 3.10 or newer.
2. Create a virtual environment:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
```

3. Install dependencies:

```powershell
python -m pip install -r requirements.txt
```

4. Start the application:

```powershell
python -m uvicorn backend.main:app --reload
```

5. Open the pages in your browser:

- Registration: `http://127.0.0.1:8000/`
- Scanner: `http://127.0.0.1:8000/scanner`
- Admin: `http://127.0.0.1:8000/admin`

## API Endpoints

- `POST /register`
- `POST /verify`
- `GET /students`
- `GET /health`

## Notes

- QR images are stored inside `qr_codes/`.
- The scanner page loads `html5-qrcode` from a CDN, so internet access is needed for the scanner library unless you vendor it locally.
- `database.db` is created automatically if it does not exist.
