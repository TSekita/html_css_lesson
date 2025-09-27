import os
from typing import Any, Dict

import requests
from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit

DEFAULT_SRS_API = os.environ.get("SRS_API", "http://127.0.0.1:1985/rtc/v1/publish/")
DEFAULT_STREAM_URL = os.environ.get("SRS_STREAM_URL", "webrtc://127.0.0.1/live/livestream")
DEFAULT_PLAY_URL = os.environ.get("SRS_PLAY_URL", "webrtc://127.0.0.1/live/livestream")

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


def _build_publish_request(sdp: str, stream_url: str, api_url: str) -> Dict[str, Any]:
    return {
        "api": api_url,
        "streamurl": stream_url,
        "clientip": None,
        "sdp": sdp,
    }


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/config")
def config() -> Any:
    return jsonify(
        {
            "api": DEFAULT_SRS_API,
            "streamUrl": DEFAULT_STREAM_URL,
            "playUrl": DEFAULT_PLAY_URL,
        }
    )


@app.route("/webrtc/publish", methods=["POST"])
def publish() -> Any:
    payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}
    sdp_offer = payload.get("sdp")
    stream_url = payload.get("streamUrl", DEFAULT_STREAM_URL)
    api_url = payload.get("apiUrl", DEFAULT_SRS_API)

    if not sdp_offer:
        return jsonify({"error": "Missing SDP offer"}), 400

    try:
        response = requests.post(
            api_url,
            json=_build_publish_request(sdp_offer, stream_url, api_url),
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        socketio.emit("publish_error", {"message": str(exc)})
        return jsonify({"error": "Failed to contact SRS", "details": str(exc)}), 502

    data = response.json()
    socketio.emit(
        "publish_status",
        {
            "status": "answer_received",
            "streamUrl": stream_url,
        },
    )
    return jsonify(data)


@socketio.on("connect")
def handle_connect() -> None:
    emit("server_ready", {"message": "SocketIO connection established"})


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
