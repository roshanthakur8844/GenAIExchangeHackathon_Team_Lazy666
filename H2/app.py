# app.py
import os
import webbrowser
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Optional Gemini SDK
try:
    import google.generativeai as genai
    GENAI_SDK = True
except Exception:
    GENAI_SDK = False

# Load .env
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Configure Gemini SDK if available & key provided
if GENAI_SDK and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        print("Warning: could not configure google.generativeai:", e)

# Absolute paths so app finds static/templates regardless of CWD
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI()

# Serve static and templates
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/chat")
async def chat(message: str = Form(...)):
    """
    Receives a message from the frontend and returns an AI reply.
    Uses google.generativeai with model 'gemini-1.5-flash' when available.
    If SDK/key missing or an error occurs, returns a friendly fallback reply.
    """
    prompt = message.strip() or "Hello"

    # If SDK + key available, try real Gemini call
    if GENAI_SDK and GEMINI_API_KEY:
        try:
            # Use the free model requested by you
            model = genai.GenerativeModel("gemini-1.5-flash")
            # The exact call below may differ across SDK versions; this works for many common versions.
            response = model.generate_content(prompt)
            # response.text or structured extraction depending on SDK
            reply = getattr(response, "text", None)
            if not reply:
                # try to harvest candidates->content->parts
                try:
                    # Many SDK responses contain candidates -> content -> parts -> text
                    candidates = getattr(response, "candidates", None) or response.get("candidates", None)
                    if candidates:
                        reply = candidates[0]["content"]["parts"][0]["text"]
                except Exception:
                    reply = None
            if not reply:
                reply = "Let's take a soft breath together — inhale... exhale..."
            return JSONResponse({"reply": reply})
        except Exception as e:
            # Log error and fall back
            print("Gemini call failed:", e)

    # Fallback simple reply logic (keeps prototype usable)
    lower = prompt.lower()
    if any(x in lower for x in ["sad", "down", "unhappy", "depressed", "lonely"]):
        reply = ("I hear you — that sounds heavy. Try a 2-minute breathing exercise: "
                 "inhale 4s, hold 4s, exhale 6s. Micro-challenge: step outside for 2 minutes.")
    elif any(x in lower for x in ["anxious", "anxiety", "stressed", "nervous"]):
        reply = ("When anxiety rises, try grounding: name 5 things you can see, 4 you can touch, 3 you can hear.")
    elif "bored" in lower:
        reply = ("Boredom can be a spark. Micro-challenge: pick one small thing to try for 3 minutes.")
    else:
        fallback_examples = [
            "Try the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.",
            "Turn off notifications for one hour and notice how you feel.",
            "Take three gentle breaths: in for 4, out for 6."
        ]
        import random
        reply = random.choice(fallback_examples)

    return JSONResponse({"reply": reply})


if __name__ == "__main__":
    url = "http://127.0.0.1:8000"
    print(f"Starting server at {url}")
    # attempt to open browser
    try:
        webbrowser.open(url)
    except Exception:
        pass
    uvicorn.run(app, host="127.0.0.1", port=8000)
