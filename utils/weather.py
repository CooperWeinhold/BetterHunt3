# utils/weather.py
import requests
from flask import jsonify

def get_weather(lat, lon):
    """Fetch current, hourly, and 7-day daily weather using Open-Meteo."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "timezone": "auto",
        "current_weather": True,

        # Units for the US
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",

        # We’ll render a weekly card deck
        "daily": ",".join([
            "weathercode",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
            "wind_speed_10m_max"
        ]),

        # (Optional) keep hourly precip prob if you want later charts
        "hourly": "precipitation_probability",
    }

    try:
        r = requests.get(url, params=params, timeout=12)
        r.raise_for_status()
        j = r.json()

        out = {
            "current": j.get("current_weather", {}),
            "daily": j.get("daily", {}),
            "hourly": j.get("hourly", {}),
            "timezone": j.get("timezone"),
            "units": {"temp": "°F", "wind": "mph", "pop": "%"}
        }
        return out
    except Exception as e:
        return {"error": str(e)}

def geocode_place(query):
    """Convert a place name or zip into coordinates."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": query, "count": 1, "language": "en", "format": "json"}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        j = r.json()
        if not j.get("results"):
            return None
        top = j["results"][0]
        return {
            "lat": top["latitude"],
            "lon": top["longitude"],
            "name": f"{top['name']}, {top.get('admin1', '')}"
        }
    except Exception:
        return None

