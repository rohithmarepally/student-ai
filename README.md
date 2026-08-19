# Student AI Assistant

An AI-powered learning application that allows students to upload study
documents, ask questions, generate summaries, create quizzes and build
flashcards.

## Current Status

Milestone 1: Full-stack foundation

- [x] Next.js frontend
- [x] FastAPI backend
- [x] Frontend-backend connection
- [ ] Authentication
- [ ] Document upload
- [ ] PDF processing
- [ ] Embeddings and vector search
- [ ] RAG question answering
- [ ] Quiz and flashcard generation
- [ ] Deployment

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Python
- FastAPI

### Planned Infrastructure

- Supabase Authentication
- PostgreSQL
- Supabase Storage
- pgvector
- LLM and embedding APIs

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
fastapi dev app/main.py
## PDF Processing Pipeline

Uploaded PDFs can be processed by the FastAPI backend.

```text
Authenticated user
→ FastAPI
→ Verify Supabase access token
→ Download private PDF
→ Extract text with pypdf
→ Split text into overlapping chunks
→ Store chunks in PostgreSQL
→ Mark document as ready
