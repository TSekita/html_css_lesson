# SRS WebRTC Streaming Preview

Flask + Flask-SocketIO を用いて、PC のフロントカメラ映像を [Simple Realtime Server (SRS)](https://ossrs.net/) に WebRTC で配信しながらローカルでプレビューするサンプルです。

## 必要要件

- Python 3.10+
- ローカル、もしくは到達可能な場所で稼働している SRS (WebRTC 有効)
- ブラウザは HTTPS もしくは `localhost` でアクセスする必要があります

## セットアップ

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

SRS 側では `rtc.conf` などで WebRTC を有効にし、例えば以下のような URL で publish/play できるようにしておきます。

- Publish API: `http://127.0.0.1:1985/rtc/v1/publish/`
- Stream URL: `webrtc://127.0.0.1/live/livestream`
- Play URL: `webrtc://127.0.0.1/live/livestream`

## アプリケーションの起動

```bash
python app.py
```

アプリケーションは `http://localhost:5000` で利用できます。アクセスすると次のことができます。

1. ブラウザからフロントカメラとマイクの利用許可を与える
2. SRS の Publish API / Stream URL を必要に応じて変更する
3. 「配信開始」を押すと WebRTC のオファーを SRS に送り、アンサーを受け取り配信を確立する
4. 状態ログで配信の進捗やエラーを確認する

停止ボタンで配信とカメラ利用を停止できます。

## 補足

- WebRTC シグナリングは Flask 経由で SRS の REST API にプロキシされています。
- Socket.IO で接続状況やエラーメッセージをリアルタイムに表示します。
- 環境変数 `SRS_API`, `SRS_STREAM_URL`, `SRS_PLAY_URL` を設定すると既定値を上書きできます。
