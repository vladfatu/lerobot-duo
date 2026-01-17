# WebXR Camera Viewer

A WebXR-based VR interface for viewing multiple camera streams via WebRTC.

## Folder Structure

```
web-ui/
├── index.html                    # Main HTML entry point
├── js/
│   ├── webrtc-manager.js         # WebRTC connection management
│   └── components/
│       ├── laser-visibility.js   # Laser ray visibility for VR controllers
│       ├── look-at-headset.js    # Panel rotation to face user
│       ├── panel-manager.js      # Dynamic panel creation
│       └── webrtc-video.js       # Video streaming to panels
└── README.md
```

## Components

### WebRTC Manager (`js/webrtc-manager.js`)
Handles all WebRTC connections to the camera server:
- `getCameras()` - Fetch available camera list
- `connectToCamera(cameraName, videoElement)` - Establish WebRTC connection
- `disconnect(cameraName)` - Close specific connection
- `disconnectAll()` - Close all connections

### A-Frame Components

#### `laser-visibility` (`js/components/laser-visibility.js`)
Shows/hides laser rays on VR controllers when interacting with draggable panels.

#### `look-at-headset` (`js/components/look-at-headset.js`)
Makes panels smoothly rotate to always face the user's headset.

**Schema:**
- `enabled` (boolean, default: true) - Enable/disable tracking
- `smoothing` (number, default: 0.1) - Rotation smoothness (lower = smoother)

#### `panel-manager` (`js/components/panel-manager.js`)
Dynamically creates video panels based on available cameras.

**Schema:**
- `radius` (number, default: 2) - Distance from user in meters
- `height` (number, default: 1.5) - Panel height position
- `maxAngle` (number, default: 140) - Maximum arc spread in degrees
- `anglePerPanel` (number, default: 35) - Degrees per panel
- `maxWidth` (number, default: 1.6) - Maximum panel width
- `maxHeight` (number, default: 1.2) - Maximum panel height
- `smoothing` (number, default: 0.08) - Look-at smoothing factor

#### `webrtc-video` (`js/components/webrtc-video.js`)
Streams WebRTC video to an A-Frame panel with dynamic sizing.

**Schema:**
- `camera` (string) - Camera name to connect to
- `panelIndex` (int, default: 0) - Panel index for unique IDs
- `maxWidth` (number, default: 1.6) - Maximum panel width in meters
- `maxHeight` (number, default: 1.2) - Maximum panel height in meters

## Usage

The web UI is served automatically by the WebRTC camera server. Start the server and navigate to its URL to view the interface.

### VR Controls
- **Point** at a panel to see the laser ray
- **Grip or Trigger** button to grab and drag panels
- Panels automatically face your headset as you move

## Dependencies

- [A-Frame](https://aframe.io/) 1.4.0 - WebVR/WebXR framework
- [aframe-extras](https://github.com/donmccurdy/aframe-extras) - Additional A-Frame components
- [super-hands](https://github.com/wmurphyrd/aframe-super-hands-component) - VR hand interaction
