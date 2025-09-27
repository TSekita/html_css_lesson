const statusLog = document.getElementById("statusLog");
const localVideo = document.getElementById("localVideo");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const settingsForm = document.getElementById("settingsForm");
const apiInput = document.getElementById("apiUrl");
const streamInput = document.getElementById("streamUrl");
const playInput = document.getElementById("playUrl");

let config = null;
let localStream = null;
let peer = null;
let socket = null;

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  statusLog.textContent = `[${timestamp}] ${message}\n${statusLog.textContent}`;
}

async function loadConfig() {
  try {
    const res = await fetch("/config");
    if (!res.ok) {
      throw new Error(`設定の取得に失敗しました: ${res.status}`);
    }
    config = await res.json();
    apiInput.value = config.api;
    streamInput.value = config.streamUrl;
    playInput.value = config.playUrl;
    log("初期設定を読み込みました。");
  } catch (error) {
    log(error.message);
  }
}

async function getLocalStream() {
  if (localStream) {
    return localStream;
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
    localVideo.srcObject = localStream;
    log("ローカルカメラの取得に成功しました。");
  } catch (error) {
    log(`カメラ取得エラー: ${error.message}`);
    throw error;
  }
  return localStream;
}

async function startPublish() {
  startButton.disabled = true;
  stopButton.disabled = false;

  try {
    const stream = await getLocalStream();

    peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peer.onicecandidate = async (event) => {
      if (event.candidate) {
        return;
      }
      log("SDP offer を SRS に送信します。");
      await sendOffer(peer.localDescription);
    };

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await peer.setLocalDescription(offer);
  } catch (error) {
    log(`配信開始エラー: ${error.message}`);
    startButton.disabled = false;
    stopButton.disabled = true;
  }
}

async function sendOffer(localDescription) {
  try {
    const payload = {
      sdp: localDescription.sdp,
      streamUrl: streamInput.value.trim(),
      apiUrl: apiInput.value.trim(),
    };

    const response = await fetch("/webrtc/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "SRS との通信に失敗しました");
    }

    const data = await response.json();
    if (!data.sdp) {
      throw new Error("SRS から SDP が返却されませんでした");
    }

    log("SRS から SDP answer を受信しました。");
    await peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
  } catch (error) {
    log(`SDP 送信エラー: ${error.message}`);
    stopPublish();
  }
}

function stopPublish() {
  stopButton.disabled = true;
  startButton.disabled = false;

  if (peer) {
    peer.getSenders().forEach((sender) => {
      try {
        peer.removeTrack(sender);
      } catch (e) {
        console.warn("removeTrack error", e);
      }
    });
    peer.close();
    peer = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }

  log("配信を終了しました。");
}

function setupSocketIO() {
  socket = io();
  socket.on("connect", () => log("SocketIO 接続完了"));
  socket.on("publish_status", (data) => log(`SRS 応答: ${JSON.stringify(data)}`));
  socket.on("publish_error", (data) => log(`SRS エラー: ${data.message}`));
}

startButton.addEventListener("click", startPublish);
stopButton.addEventListener("click", stopPublish);

settingsForm.addEventListener("input", () => {
  config = {
    api: apiInput.value.trim(),
    streamUrl: streamInput.value.trim(),
    playUrl: playInput.value.trim(),
  };
});

window.addEventListener("beforeunload", stopPublish);

setupSocketIO();
loadConfig();
