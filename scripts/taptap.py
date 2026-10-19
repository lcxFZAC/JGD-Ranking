"""Read-only TapTap public web API client (no login or private data)."""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = "https://www.taptap.cn"
EVENT_ID = 28
X_UA = "V=1&PN=WebApp&LANG=zh_CN&VN_CODE=100000000&LOC=CN&PLT=PC&DS=Android&OS=Windows&OSV=10&DT=PC"


def get(path, **params):
    url = urllib.parse.urljoin(ORIGIN, path)
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc != "www.taptap.cn":
        raise ValueError("Unexpected pagination host")
    query = dict(urllib.parse.parse_qsl(parsed.query))
    query.update(params)
    query["X-UA"] = X_UA
    url = urllib.parse.urlunsplit(parsed._replace(query=urllib.parse.urlencode(query)))
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
                "Accept": "application/json", "Referer": ORIGIN + "/game-jam/spotlightgamejam2026",
            })
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            if payload.get("success") is not True:
                raise ValueError(str(payload.get("data", {})))
            return payload["data"]
        except (urllib.error.URLError, TimeoutError, ValueError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
