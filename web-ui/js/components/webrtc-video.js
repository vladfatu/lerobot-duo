/**
 * WebRTC Video Component
 * Streams WebRTC video to an A-Frame panel with dynamic sizing
 */
AFRAME.registerComponent('webrtc-video', {
  schema: {
    camera: { type: 'string', default: '' },
    panelIndex: { type: 'int', default: 0 },
    maxWidth: { type: 'number', default: 1.6 },   // Maximum panel width in meters
    maxHeight: { type: 'number', default: 1.2 }   // Maximum panel height in meters
  },

  init: function() {
    this.videoEl = null;
    this.textureCreated = false;
    this.setupVideo();
  },

  setupVideo: async function() {
    const cameraName = this.data.camera;
    if (!cameraName) {
      console.log(`No camera specified for panel ${this.data.panelIndex}`);
      return;
    }

    // Create hidden video element
    this.videoEl = document.createElement('video');
    this.videoEl.id = `video-${this.data.panelIndex}`;
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('autoplay', '');
    this.videoEl.muted = true;
    this.videoEl.style.display = 'none';
    document.body.appendChild(this.videoEl);

    console.log(`Panel ${this.data.panelIndex} connecting to camera: ${cameraName}`);

    // Update label
    const textEl = this.el.querySelector('a-text');
    if (textEl) {
      textEl.setAttribute('value', cameraName);
    }

    // Connect to WebRTC stream
    const connected = await WebRTCManager.connectToCamera(cameraName, this.videoEl);

    if (connected) {
      // Wait for video to have data then create texture
      this.videoEl.addEventListener('loadeddata', () => {
        this.createVideoTexture();
      });

      // Also try after a short delay as backup
      setTimeout(() => {
        if (!this.textureCreated) {
          this.createVideoTexture();
        }
      }, 2000);
    }
  },

  /**
   * Resize panel to match video aspect ratio while staying within max bounds
   */
  resizePanelToVideo: function(videoWidth, videoHeight) {
    const aspectRatio = videoWidth / videoHeight;
    const maxWidth = this.data.maxWidth;
    const maxHeight = this.data.maxHeight;

    let panelWidth, panelHeight;

    // Calculate dimensions that fit within max bounds while preserving aspect ratio
    if (aspectRatio > maxWidth / maxHeight) {
      // Video is wider than max aspect ratio - constrain by width
      panelWidth = maxWidth;
      panelHeight = maxWidth / aspectRatio;
    } else {
      // Video is taller - constrain by height
      panelHeight = maxHeight;
      panelWidth = maxHeight * aspectRatio;
    }

    // Update the box (panel background) size
    this.el.setAttribute('width', panelWidth);
    this.el.setAttribute('height', panelHeight);
    this.el.setAttribute('depth', 0.05);

    console.log(`Panel ${this.data.panelIndex} resized to ${panelWidth.toFixed(2)}x${panelHeight.toFixed(2)} (video: ${videoWidth}x${videoHeight}, aspect: ${aspectRatio.toFixed(2)})`);

    return { width: panelWidth, height: panelHeight };
  },

  createVideoTexture: function() {
    if (this.textureCreated || !this.videoEl.srcObject) return;

    // Get video dimensions
    const videoWidth = this.videoEl.videoWidth || 640;
    const videoHeight = this.videoEl.videoHeight || 480;

    // Resize panel based on video aspect ratio
    const { width: panelWidth, height: panelHeight } = this.resizePanelToVideo(videoWidth, videoHeight);

    // Create A-Frame asset for the video
    const assets = document.querySelector('a-assets') || this.createAssets();

    // Register video as asset
    const assetVideo = document.createElement('video');
    assetVideo.id = `asset-video-${this.data.panelIndex}`;
    assetVideo.srcObject = this.videoEl.srcObject;
    assetVideo.setAttribute('playsinline', '');
    assetVideo.setAttribute('autoplay', '');
    assetVideo.muted = true;
    assets.appendChild(assetVideo);
    assetVideo.play().catch(e => console.log('Asset video play error:', e));

    // Apply video texture to the panel (front face) - sized to match panel with small margin
    const planeEl = document.createElement('a-plane');
    planeEl.setAttribute('position', '0 0 0.026');
    planeEl.setAttribute('width', panelWidth - 0.02);
    planeEl.setAttribute('height', panelHeight - 0.02);
    planeEl.setAttribute('material', `shader: flat; src: #asset-video-${this.data.panelIndex}; side: front`);
    this.el.appendChild(planeEl);

    // Update text position to be at the bottom of the panel
    const textEl = this.el.querySelector('a-text');
    if (textEl) {
      textEl.setAttribute('position', `0 ${-panelHeight / 2 - 0.08} 0.03`);
      textEl.setAttribute('width', '1.5');
    }

    this.textureCreated = true;
    console.log(`Video texture created for panel ${this.data.panelIndex}`);
  },

  createAssets: function() {
    const assets = document.createElement('a-assets');
    this.el.sceneEl.insertBefore(assets, this.el.sceneEl.firstChild);
    return assets;
  },

  remove: function() {
    if (this.videoEl && this.videoEl.parentNode) {
      this.videoEl.parentNode.removeChild(this.videoEl);
    }
  }
});
