"""API 请求日志中间件 — Change 0。

记录每次请求的 method/path/耗时/status，写文件日志 + operations 表。
不吞异常。
"""
import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .log_store import log_operation

log = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        except Exception:
            log.exception("unhandled error in %s %s", request.method, request.url.path)
            raise
        finally:
            duration_ms = int((time.perf_counter() - start) * 1000)
            try:
                log_operation(request.method, request.url.path, status, duration_ms)
            except Exception:
                log.exception("failed to write operation log")
