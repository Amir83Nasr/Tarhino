def parse_device(user_agent: str | None) -> str | None:
    """Turn a raw User-Agent into a short Persian device label."""
    if not user_agent:
        return None
    ua = user_agent.lower()

    if "iphone" in ua:
        device = "آیفون"
    elif "ipad" in ua:
        device = "آیپد"
    elif "android" in ua:
        device = "گوشی اندرویدی"
    elif "macintosh" in ua or "mac os" in ua:
        device = "مک"
    elif "windows" in ua:
        device = "ویندوز"
    elif "linux" in ua:
        device = "لینوکس"
    else:
        device = "دستگاه ناشناس"

    if "edg/" in ua or "edge/" in ua:
        browser = "اج"
    elif "opr/" in ua or "opera" in ua:
        browser = "اپرا"
    elif "firefox" in ua or "fxios" in ua:
        browser = "فایرفاکس"
    elif "crios" in ua or "chrome" in ua:
        browser = "کروم"
    elif "safari" in ua:
        browser = "سافاری"
    else:
        browser = None

    return f"{device} · {browser}" if browser else device
