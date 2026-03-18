from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "state.json"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_id() -> str:
    return str(uuid.uuid4())


def ensure_state_file() -> None:
    if STATE_PATH.exists():
        return

    seed = {
        "version": 1,
        "updatedAt": now_iso(),
        "profile": {
            "nickname": "曦哥",
        },
        "dashboardSettings": {
            "dailyTargetHours": 8,
            "hourlyRate": 120,
            "debtStartDate": datetime.now().date().isoformat(),
        },
        "projectTypes": [],
        "projects": [],
        "sessions": [],
    }
    STATE_PATH.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")


def load_state() -> dict[str, Any]:
    ensure_state_file()
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict[str, Any]) -> None:
    state["updatedAt"] = now_iso()
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_imported_state(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": int(state.get("version", 1)),
        "updatedAt": state.get("updatedAt") or now_iso(),
        "profile": state.get("profile") or {"nickname": ""},
        "dashboardSettings": state.get("dashboardSettings") or {
            "dailyTargetHours": 8,
            "hourlyRate": 120,
            "debtStartDate": datetime.now().date().isoformat(),
        },
        "projectTypes": state.get("projectTypes") or [],
        "projects": state.get("projects") or [],
        "sessions": state.get("sessions") or [],
    }


def find_project(state: dict[str, Any], project_id: str) -> dict[str, Any] | None:
    return next((project for project in state["projects"] if project["id"] == project_id), None)


def find_session(state: dict[str, Any], session_id: str) -> dict[str, Any] | None:
    return next((session for session in state["sessions"] if session["id"] == session_id), None)


def get_running_self_session(state: dict[str, Any]) -> dict[str, Any] | None:
    for session in state["sessions"]:
        if session["endAt"] is not None:
            continue
        project = find_project(state, session["projectId"])
        if project and project["actor"] == "self":
            return session
    return None


def get_running_sessions(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [session for session in state["sessions"] if session["endAt"] is None]


def finish_session(session: dict[str, Any], finished_at: str | None = None) -> None:
    end_at = finished_at or now_iso()
    start_dt = datetime.fromisoformat(session["startAt"])
    end_dt = datetime.fromisoformat(end_at)
    duration_ms = max(0, int((end_dt - start_dt).total_seconds() * 1000))
    session["endAt"] = end_at
    session["durationMs"] = duration_ms
    session["updatedAt"] = now_iso()


def serialize_session(state: dict[str, Any], session: dict[str, Any]) -> dict[str, Any]:
    project = find_project(state, session["projectId"])
    project_type = next((item for item in state["projectTypes"] if item["id"] == project["typeId"]), None) if project else None
    return {
        **session,
        "project": project,
        "projectType": project_type,
    }


def start_session(state: dict[str, Any], project_id: str) -> dict[str, Any]:
    project = find_project(state, project_id)
    if not project:
        raise ValueError("project_not_found")
    if project["archived"]:
        raise ValueError("project_archived")

    if project["actor"] == "self":
        running_self = get_running_self_session(state)
        if running_self:
            finish_session(running_self)

    start_at = now_iso()
    session = {
        "id": create_id(),
        "projectId": project_id,
        "startAt": start_at,
        "endAt": None,
        "note": "",
        "durationMs": None,
        "createdAt": start_at,
        "updatedAt": start_at,
    }
    state["sessions"].insert(0, session)
    project["usageCount"] = int(project.get("usageCount", 0)) + 1
    project["lastUsedAt"] = start_at
    project["updatedAt"] = start_at
    save_state(state)
    return serialize_session(state, session)


def stop_session(state: dict[str, Any], session_id: str) -> dict[str, Any]:
    session = find_session(state, session_id)
    if not session:
        raise ValueError("session_not_found")
    if session["endAt"] is not None:
        raise ValueError("session_already_stopped")

    finish_session(session)
    save_state(state)
    return serialize_session(state, session)


def patch_session(state: dict[str, Any], session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    session = find_session(state, session_id)
    if not session:
        raise ValueError("session_not_found")

    start_at = payload.get("startAt", session["startAt"])
    end_at = payload.get("endAt", session["endAt"])
    note = payload.get("note", session["note"])

    start_dt = datetime.fromisoformat(start_at)
    end_dt = datetime.fromisoformat(end_at) if end_at else None
    if end_dt and end_dt < start_dt:
      raise ValueError("invalid_time_range")

    session["startAt"] = start_at
    session["endAt"] = end_at
    session["note"] = str(note)
    session["updatedAt"] = now_iso()
    session["durationMs"] = None if not end_at else max(0, int((end_dt - start_dt).total_seconds() * 1000))
    save_state(state)
    return serialize_session(state, session)


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


class TempoApiHandler(BaseHTTPRequestHandler):
    server_version = "TempoAgentApi/0.1"

    def do_OPTIONS(self) -> None:
        json_response(self, HTTPStatus.NO_CONTENT, {"ok": True})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        state = load_state()

        if parsed.path == "/api/health":
            json_response(self, HTTPStatus.OK, {"ok": True, "service": "tempo-agent-api"})
            return

        if parsed.path == "/api/state":
            json_response(self, HTTPStatus.OK, {"ok": True, "data": state})
            return

        if parsed.path == "/api/projects":
            query = parse_qs(parsed.query)
            archived_param = query.get("archived", [None])[0]
            projects = state["projects"]
            if archived_param is not None:
                archived = archived_param.lower() == "true"
                projects = [item for item in projects if bool(item["archived"]) is archived]
            json_response(self, HTTPStatus.OK, {"ok": True, "data": projects})
            return

        if parsed.path == "/api/sessions":
            query = parse_qs(parsed.query)
            status_filter = query.get("status", ["all"])[0]
            sessions = state["sessions"]
            if status_filter == "running":
                sessions = [item for item in sessions if item["endAt"] is None]
            elif status_filter == "completed":
                sessions = [item for item in sessions if item["endAt"] is not None]
            json_response(
                self,
                HTTPStatus.OK,
                {"ok": True, "data": [serialize_session(state, session) for session in sessions]},
            )
            return

        if parsed.path == "/api/running":
            json_response(
                self,
                HTTPStatus.OK,
                {"ok": True, "data": [serialize_session(state, session) for session in get_running_sessions(state)]},
            )
            return

        json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        state = load_state()
        payload = self._read_json_body()

        try:
            if parsed.path == "/api/state/import":
                imported = normalize_imported_state(payload.get("state") or {})
                save_state(imported)
                json_response(self, HTTPStatus.OK, {"ok": True, "data": imported})
                return

            if parsed.path == "/api/sessions/start":
                session = start_session(state, payload.get("projectId", ""))
                json_response(self, HTTPStatus.CREATED, {"ok": True, "data": session})
                return

            if parsed.path == "/api/sessions/stop":
                session = stop_session(state, payload.get("sessionId", ""))
                json_response(self, HTTPStatus.OK, {"ok": True, "data": session})
                return

            json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
        except ValueError as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        state = load_state()
        payload = self._read_json_body()

        if not parsed.path.startswith("/api/sessions/"):
            json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
            return

        session_id = parsed.path.rsplit("/", 1)[-1]
        try:
            session = patch_session(state, session_id, payload)
            json_response(self, HTTPStatus.OK, {"ok": True, "data": session})
        except ValueError as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))


def main() -> None:
    ensure_state_file()
    server = ThreadingHTTPServer((DEFAULT_HOST, DEFAULT_PORT), TempoApiHandler)
    print(f"Tempo agent API running on http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
