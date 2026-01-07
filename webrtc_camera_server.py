import asyncio
import json
import logging
import threading
import time
from typing import Dict, Optional

import cv2
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaPlayer
from aiohttp import web, web_request
from aiohttp_cors import setup as cors_setup, CorsConfig
import av


class CameraStreamTrack(VideoStreamTrack):
    """Custom video track that streams camera frames."""
    
    def __init__(self, camera_name: str):
        super().__init__()
        self.camera_name = camera_name
        self.current_frame: Optional[np.ndarray] = None
        self.frame_lock = threading.Lock()
        
    def update_frame(self, frame: np.ndarray):
        """Update the current frame to be streamed."""
        with self.frame_lock:
            self.current_frame = frame.copy() if frame is not None else None
    
    async def recv(self):
        """Generate video frames for WebRTC."""
        pts, time_base = await self.next_timestamp()
        
        with self.frame_lock:
            if self.current_frame is not None:
                # Convert BGR to RGB (OpenCV uses BGR by default)
                rgb_frame = cv2.cvtColor(self.current_frame, cv2.COLOR_BGR2RGB)
            else:
                # Create a black frame if no frame is available
                rgb_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                
        # Convert numpy array to av.VideoFrame
        frame = av.VideoFrame.from_ndarray(rgb_frame, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        
        return frame


class WebRTCCameraServer:
    """WebRTC server for streaming multiple camera feeds."""
    
    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.app = web.Application()
        self.pcs: set = set()
        self.camera_tracks: Dict[str, CameraStreamTrack] = {}
        
        # Setup CORS
        cors = cors_setup(self.app, defaults={
            "*": CorsConfig(
                allow_all=True,
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Setup routes
        self.app.router.add_get("/", self.index)
        self.app.router.add_post("/offer", self.offer)
        self.app.router.add_get("/cameras", self.get_cameras)
        
        # Add CORS to all routes
        for route in list(self.app.router.routes()):
            cors.add(route)
            
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
    def add_camera(self, camera_name: str):
        """Add a camera stream."""
        self.camera_tracks[camera_name] = CameraStreamTrack(camera_name)
        self.logger.info(f"Added camera: {camera_name}")
    
    def update_camera_frame(self, camera_name: str, frame: np.ndarray):
        """Update frame for a specific camera."""
        if camera_name in self.camera_tracks:
            self.camera_tracks[camera_name].update_frame(frame)
    
    async def index(self, request):
        """Serve a simple HTML page for testing."""
        return web.Response(text="""
<!DOCTYPE html>
<html>
<head>
    <title>Camera Streams</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .camera-grid { display: flex; flex-wrap: wrap; gap: 20px; }
        .camera-container { border: 1px solid #ccc; padding: 10px; border-radius: 5px; }
        video { width: 320px; height: 240px; border: 1px solid #000; }
        button { padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <h1>Robot Camera Streams</h1>
    <div id="cameras"></div>
    <script>
        let peerConnections = {};
        
        async function startStream(cameraName) {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            peerConnections[cameraName] = pc;
            
            pc.ontrack = function(event) {
                const video = document.getElementById('video-' + cameraName);
                if (video) {
                    video.srcObject = event.streams[0];
                }
            };
            
            // Add transceiver to receive video
            pc.addTransceiver('video', {direction: 'recvonly'});
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            const response = await fetch('/offer', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type,
                    camera: cameraName
                })
            });
            
            const answer = await response.json();
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
        
        async function loadCameras() {
            try {
                const response = await fetch('/cameras');
                const cameras = await response.json();
                
                const camerasDiv = document.getElementById('cameras');
                camerasDiv.innerHTML = '';
                
                cameras.forEach(camera => {
                    const container = document.createElement('div');
                    container.className = 'camera-container';
                    container.innerHTML = `
                        <h3>${camera}</h3>
                        <video id="video-${camera}" autoplay muted></video><br>
                        <button onclick="startStream('${camera}')">Start Stream</button>
                        <button onclick="stopStream('${camera}')">Stop Stream</button>
                    `;
                    camerasDiv.appendChild(container);
                });
            } catch (error) {
                console.error('Error loading cameras:', error);
            }
        }
        
        function stopStream(cameraName) {
            if (peerConnections[cameraName]) {
                peerConnections[cameraName].close();
                delete peerConnections[cameraName];
            }
        }
        
        // Load cameras on page load
        loadCameras();
    </script>
</body>
</html>
        """, content_type='text/html')
    
    async def get_cameras(self, request):
        """Return list of available cameras."""
        return web.json_response(list(self.camera_tracks.keys()))
    
    async def offer(self, request):
        """Handle WebRTC offer."""
        params = await request.json()
        camera_name = params.get('camera', 'default')
        
        offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])
        
        pc = RTCPeerConnection()
        self.pcs.add(pc)
        
        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            self.logger.info(f"Connection state for {camera_name}: {pc.connectionState}")
            if pc.connectionState == "failed":
                await pc.close()
                if pc in self.pcs:
                    self.pcs.discard(pc)
        
        # Add video track
        if camera_name in self.camera_tracks:
            pc.addTrack(self.camera_tracks[camera_name])
        
        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        return web.json_response({
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        })
    
    async def start_server(self):
        """Start the WebRTC server."""
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        self.logger.info(f"WebRTC Camera Server started on http://{self.host}:{self.port}")
    
    def run_in_thread(self):
        """Run the server in a background thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        async def run():
            await self.start_server()
            try:
                await asyncio.Future()  # Run forever
            except asyncio.CancelledError:
                pass
        
        loop.run_until_complete(run())


def create_camera_server() -> WebRTCCameraServer:
    """Create and configure the camera server."""
    server = WebRTCCameraServer()
    
    # Add your camera streams
    server.add_camera("left_wrist")
    server.add_camera("right_wrist")
    server.add_camera("above")
    
    return server


if __name__ == "__main__":
    server = create_camera_server()
    asyncio.run(server.start_server())
    print("Server running. Press Ctrl+C to stop.")
    try:
        asyncio.run(asyncio.Future())  # Run forever
    except KeyboardInterrupt:
        print("Server stopped.")