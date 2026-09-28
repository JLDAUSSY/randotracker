import asyncio
import json
import os
import socket
from aiohttp import web

# Active connected websocket clients
connected_clients = set()
# In-memory store of active users (up to 10)
active_users = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_local_ip():
    """Find the primary local IP address to make it easy to connect from a smartphone."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

async def index_handler(request):
    return web.FileResponse(os.path.join(BASE_DIR, "index.html"))

async def ws_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    connected_clients.add(ws)
    print(f"[WS] Nouveau client connecte. Total: {len(connected_clients)}")

    # Send current state of all active users to the newly connected client
    await ws.send_str(json.dumps({
        "type": "init_state",
        "users": list(active_users.values())
    }))

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    msg_type = data.get("type")

                    if msg_type == "update_position":
                        user = data.get("user")
                        if user and "id" in user:
                            active_users[user["id"]] = user
                            # Broadcast to all other clients
                            broadcast_msg = json.dumps({
                                "type": "user_updated",
                                "user": user
                            })
                            for client in connected_clients:
                                if client != ws and not client.closed:
                                    await client.send_str(broadcast_msg)

                    elif msg_type == "user_leave":
                        user_id = data.get("userId")
                        if user_id in active_users:
                            del active_users[user_id]
                            broadcast_msg = json.dumps({
                                "type": "user_left",
                                "userId": user_id
                            })
                            for client in connected_clients:
                                if not client.closed:
                                    await client.send_str(broadcast_msg)

                    elif msg_type == "clear_users":
                        active_users.clear()
                        broadcast_msg = json.dumps({"type": "all_users_cleared"})
                        for client in connected_clients:
                            if not client.closed:
                                await client.send_str(broadcast_msg)

                except json.JSONDecodeError:
                    pass
            elif msg.type == web.WSMsgType.ERROR:
                print(f"[WS] Erreur websocket: {ws.exception()}")
    finally:
        connected_clients.remove(ws)
        print(f"[WS] Client deconnecte. Total restant: {len(connected_clients)}")

    return ws

async def list_tracks(request):
    tracks_dir = os.path.join(BASE_DIR, "tracks")
    files = []
    if os.path.exists(tracks_dir):
        for f in os.listdir(tracks_dir):
            if f.lower().endswith(".gpx"):
                files.append(f)
    return web.json_response({"tracks": files})

def create_app():
    app = web.Application()
    app.router.add_get("/", index_handler)
    app.router.add_get("/ws", ws_handler)
    app.router.add_get("/api/tracks", list_tracks)
    # Serve static assets (CSS, JS, tracks)
    app.router.add_static("/", path=BASE_DIR, show_index=False)
    return app

if __name__ == "__main__":
    port = 8000
    local_ip = get_local_ip()
    print("=" * 65)
    print("   [+] RANDO TRACKER - SERVEUR DE SUIVI EN DIRECT")
    print("=" * 65)
    print(f"  Acces local (ce PC)          : http://localhost:{port}")
    print(f"  Acces smartphone (meme WiFi) : http://{local_ip}:{port}")
    print("=" * 65)
    print("Appuyez sur Ctrl+C pour arreter le serveur.")
    
    app = create_app()
    web.run_app(app, host="0.0.0.0", port=port)
