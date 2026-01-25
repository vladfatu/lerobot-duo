/**
 * WebSocket Panel Component
 * Creates a UI panel showing WebSocket connection status with connect/disconnect button
 */
AFRAME.registerComponent('websocket-panel', {
  schema: {
    width: { type: 'number', default: 0.5 },
    height: { type: 'number', default: 0.3 },
    position: { type: 'vec3', default: { x: -1.5, y: 1.2, z: -1.5 } }
  },

  init: function() {
    this.isHovered = false;
    this.isConnecting = false; // Prevent multiple simultaneous connection attempts
    
    // Bind methods
    this.onConnect = this.onConnect.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    
    this.createPanel();
    
    // Update status periodically
    this.tick = AFRAME.utils.throttleTick(this.tick, 500, this);
  },

  createPanel: function() {
    const { width, height, position } = this.data;
    
    // Main panel container - use a-box for raycaster hit detection (draggable)
    this.panel = document.createElement('a-box');
    this.panel.setAttribute('class', 'draggable');
    this.panel.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
    this.panel.setAttribute('width', width);
    this.panel.setAttribute('height', height);
    this.panel.setAttribute('depth', '0.02');
    this.panel.setAttribute('color', '#1a1a2e');
    this.panel.setAttribute('opacity', '0.9');
    this.panel.setAttribute('grabbable', 'startButtons: triggerdown; endButtons: triggerup');
    this.panel.setAttribute('draggable', '');
    this.panel.setAttribute('look-at-headset', 'smoothing: 0.05');
    
    // Title
    const title = document.createElement('a-text');
    title.setAttribute('value', 'WebSocket');
    title.setAttribute('align', 'center');
    title.setAttribute('position', `0 ${height * 0.32} 0.015`);
    title.setAttribute('width', width * 1.5);
    title.setAttribute('color', '#ffffff');
    this.panel.appendChild(title);
    
    // Status indicator (circle)
    this.statusIndicator = document.createElement('a-circle');
    this.statusIndicator.setAttribute('radius', '0.02');
    this.statusIndicator.setAttribute('position', `${-width * 0.3} ${height * 0.05} 0.015`);
    this.statusIndicator.setAttribute('color', '#ff4444'); // Red = disconnected
    this.panel.appendChild(this.statusIndicator);
    
    // Status text
    this.statusText = document.createElement('a-text');
    this.statusText.setAttribute('value', 'Disconnected');
    this.statusText.setAttribute('align', 'left');
    this.statusText.setAttribute('position', `${-width * 0.2} ${height * 0.05} 0.015`);
    this.statusText.setAttribute('width', width * 1.2);
    this.statusText.setAttribute('color', '#cccccc');
    this.panel.appendChild(this.statusText);
    
    // Connect/Disconnect button
    this.button = document.createElement('a-plane');
    this.button.setAttribute('class', 'clickable');
    this.button.setAttribute('width', width * 0.7);
    this.button.setAttribute('height', height * 0.25);
    this.button.setAttribute('position', `0 ${-height * 0.25} 0.015`);
    this.button.setAttribute('color', '#4CAF50');
    this.button.setAttribute('opacity', '0.9');
    
    // Button text
    this.buttonText = document.createElement('a-text');
    this.buttonText.setAttribute('value', 'Connect');
    this.buttonText.setAttribute('align', 'center');
    this.buttonText.setAttribute('position', '0 0 0.005');
    this.buttonText.setAttribute('width', width * 1.5);
    this.buttonText.setAttribute('color', '#ffffff');
    this.button.appendChild(this.buttonText);
    
    // Button interaction events - use raycaster events for VR
    this.button.addEventListener('click', this.onConnect);
    this.button.addEventListener('raycaster-intersected', this.onMouseEnter);
    this.button.addEventListener('raycaster-intersected-cleared', this.onMouseLeave);
    
    this.panel.appendChild(this.button);
    this.el.appendChild(this.panel);
  },

  onMouseEnter: function() {
    this.isHovered = true;
    this.button.setAttribute('opacity', '1.0');
    this.button.setAttribute('scale', '1.05 1.05 1.05');
  },

  onMouseLeave: function() {
    this.isHovered = false;
    this.button.setAttribute('opacity', '0.9');
    this.button.setAttribute('scale', '1 1 1');
  },

  onConnect: async function(event) {
    // Prevent event bubbling and multiple triggers
    if (event) {
      event.stopPropagation();
    }
    
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      return;
    }
    
    if (!window.webSocketManager) {
      console.warn('⚠️ WebSocket manager not available');
      return;
    }
    
    this.isConnecting = true;
    
    // Disable button during connection attempt
    this.button.setAttribute('color', '#888888');
    this.buttonText.setAttribute('value', '...');
    
    try {
      const connected = await window.webSocketManager.toggleConnection();
      console.log(`🔌 WebSocket ${connected ? 'connected' : 'disconnected'}`);
    } catch (error) {
      console.error('❌ Connection error:', error);
    } finally {
      this.isConnecting = false;
    }
    
    // Update will happen in tick
  },

  tick: function() {
    if (!window.webSocketManager) return;
    
    const isConnected = window.webSocketManager.isConnected;
    
    // Update status indicator
    this.statusIndicator.setAttribute('color', isConnected ? '#44ff44' : '#ff4444');
    
    // Update status text
    this.statusText.setAttribute('value', isConnected ? 'Connected' : 'Disconnected');
    
    // Update button
    if (!this.isHovered) {
      if (isConnected) {
        this.button.setAttribute('color', '#f44336'); // Red for disconnect
        this.buttonText.setAttribute('value', 'Disconnect');
      } else {
        this.button.setAttribute('color', '#4CAF50'); // Green for connect
        this.buttonText.setAttribute('value', 'Connect');
      }
    }
  },

  remove: function() {
    this.button.removeEventListener('click', this.onConnect);
    this.button.removeEventListener('raycaster-intersected', this.onMouseEnter);
    this.button.removeEventListener('raycaster-intersected-cleared', this.onMouseLeave);
    
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
});
