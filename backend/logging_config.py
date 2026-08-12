"""logging 配置 — Change 0。

文件日志按天轮转，保留 7 天，目录 ./logs/。
"""
import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "app.log"
RETAIN_DAYS = 7

_configured = False


def setup_logging():
    global _configured
    if _configured:
        return
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    handler = TimedRotatingFileHandler(
        LOG_FILE, when="midnight", backupCount=RETAIN_DAYS, encoding="utf-8"
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # 避免重复 handler
    if not any(isinstance(h, TimedRotatingFileHandler) for h in root.handlers):
        root.addHandler(handler)
    # 控制台也输出一份，便于本地开发
    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, TimedRotatingFileHandler) for h in root.handlers):
        console = logging.StreamHandler()
        console.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        root.addHandler(console)

    _configured = True
