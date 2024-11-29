# AI Content Generation Service

A subscription-based AI content generation service built with FastAPI and OpenAI.

## Features
- AI-powered content generation
- Subscription-based pricing
- Secure payment processing with Stripe
- User authentication and management
- API rate limiting

## Setup Instructions

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a .env file with your API keys:
```
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

4. Run the application:
```bash
uvicorn main:app --reload
```

## Usage
Visit http://localhost:8000 to access the web interface.

## API Documentation
Once the server is running, visit http://localhost:8000/docs for the interactive API documentation.
