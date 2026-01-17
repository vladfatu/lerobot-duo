/**
 * Panel Manager Component
 * Dynamically creates video panels based on available camera streams
 */
AFRAME.registerComponent('panel-manager', {
  schema: {
    panelSpacing: { type: 'number', default: 1.8 },
    radius: { type: 'number', default: 2 },        // Distance from user
    height: { type: 'number', default: 1.5 },      // Height of panels
    maxAngle: { type: 'number', default: 140 },    // Max arc spread in degrees
    anglePerPanel: { type: 'number', default: 35 }, // Degrees per panel
    maxWidth: { type: 'number', default: 1.6 },    // Max panel width
    maxHeight: { type: 'number', default: 1.2 },   // Max panel height
    smoothing: { type: 'number', default: 0.08 }   // Look-at smoothing
  },

  init: async function() {
    // Wait for scene to be fully loaded
    if (this.el.sceneEl.hasLoaded) {
      await this.createPanels();
    } else {
      this.el.sceneEl.addEventListener('loaded', () => this.createPanels());
    }
  },

  createPanels: async function() {
    const cameras = await WebRTCManager.getCameras();
    console.log('Available cameras:', cameras);

    if (cameras.length === 0) {
      console.log('No cameras available');
      // Create a placeholder panel
      this.createPanel('No cameras available', 0, 1);
      return;
    }

    const numCameras = cameras.length;

    cameras.forEach((cameraName, index) => {
      this.createPanel(cameraName, index, numCameras);
    });
  },

  /**
   * Create a single video panel
   * @param {string} cameraName - The camera name to connect to
   * @param {number} index - Panel index
   * @param {number} totalPanels - Total number of panels
   */
  createPanel: function(cameraName, index, totalPanels) {
    const { radius, height, maxAngle, anglePerPanel, maxWidth, maxHeight, smoothing } = this.data;

    // Calculate angle for arc arrangement
    const totalAngle = Math.min(totalPanels * anglePerPanel, maxAngle);
    const startAngle = totalAngle / 2;
    const angleStep = totalPanels > 1 ? totalAngle / (totalPanels - 1) : 0;
    const angle = totalPanels > 1 ? startAngle - (index * angleStep) : 0;
    const angleRad = (angle * Math.PI) / 180;

    // Calculate x and z position on arc
    const x = Math.sin(angleRad) * radius;
    const z = -Math.cos(angleRad) * radius;

    // Create panel entity with placeholder size (will be resized when video loads)
    const panel = document.createElement('a-box');
    panel.setAttribute('class', 'draggable');
    panel.setAttribute('position', `${x} ${height} ${z}`);
    panel.setAttribute('rotation', `0 ${angle} 0`);
    panel.setAttribute('width', '0.8');   // Placeholder - resized by webrtc-video when stream loads
    panel.setAttribute('height', '0.6');  // Placeholder - resized by webrtc-video when stream loads
    panel.setAttribute('depth', '0.05');
    panel.setAttribute('color', '#333');
    panel.setAttribute('grabbable', 'startButtons: gripdown, triggerdown; endButtons: gripup, triggerup');
    panel.setAttribute('draggable', '');
    panel.setAttribute('shadow', '');
    panel.setAttribute('webrtc-video', `camera: ${cameraName}; panelIndex: ${index}; maxWidth: ${maxWidth}; maxHeight: ${maxHeight}`);
    panel.setAttribute('look-at-headset', `smoothing: ${smoothing}`);

    // Add text label
    const text = document.createElement('a-text');
    text.setAttribute('value', 'Connecting...');
    text.setAttribute('align', 'center');
    text.setAttribute('position', '0 0 0.03');
    text.setAttribute('width', '2');
    text.setAttribute('color', '#ffffff');
    panel.appendChild(text);

    this.el.appendChild(panel);
    console.log(`Created panel ${index} for camera: ${cameraName} at angle ${angle}°`);
  },

  /**
   * Remove all panels
   */
  clearPanels: function() {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }
  },

  /**
   * Refresh panels (re-fetch cameras and recreate)
   */
  refresh: async function() {
    this.clearPanels();
    await this.createPanels();
  }
});
