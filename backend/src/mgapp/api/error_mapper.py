"""Error and Status mapper (component 3; Doc 6 §1, §5).

Analysis outcomes are always HTTP 200 (handled by the pipeline). This module maps
transport problems to 4xx TransportError bodies and defects to 500; no 422 anywhere.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from mgapp.domain.meta import TransportError

log = logging.getLogger("mgapp.api")

CODES = {
    400: "MALFORMED_JSON",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    500: "INTERNAL_ERROR",
}
MESSAGES = {
    400: "The request body is not valid JSON.",
    404: "No such API route.",
    405: "This method is not allowed on this route.",
    413: "The request body is too large.",
    415: "Send the request as application/json.",
    500: "Internal error in the application.",
}


class TransportFailureError(Exception):
    def __init__(self, status: int, code: str | None = None, message: str | None = None) -> None:
        self.status = status
        self.code = code or CODES.get(status, "ERROR")
        self.message = message or MESSAGES.get(status, "Request failed.")


def error_response(
    status: int, code: str | None = None, message: str | None = None
) -> JSONResponse:
    body = TransportError(
        code=code or CODES.get(status, "ERROR"),
        message=message or MESSAGES.get(status, "Request failed."),
    )
    return JSONResponse(status_code=status, content=body.model_dump())


def install(app: FastAPI) -> None:
    @app.exception_handler(TransportFailureError)
    async def _transport(_: Request, exc: TransportFailureError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error_response(exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Not reachable for analysis routes (they parse bodies themselves); never 422.
        return error_response(400, "MALFORMED_REQUEST", "The request could not be read.")

    @app.exception_handler(Exception)
    async def _defect(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", exc_info=exc)
        return error_response(500)
