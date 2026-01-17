/**
 * Laser Visibility Component
 * Shows/hides laser ray when hovering over or grabbing draggable objects
 */
AFRAME.registerComponent('laser-visibility', {
  init: function() {
    this.bindEvents();
  },

  bindEvents: function() {
    // Show laser when intersecting with draggable objects
    this.el.addEventListener('raycaster-intersection', (e) => {
      const intersectedEl = e.detail.els[0];
      if (intersectedEl && intersectedEl.classList.contains('draggable')) {
        this.showLaser();
      }
    });

    // Hide laser when no longer intersecting (unless grabbing)
    this.el.addEventListener('raycaster-intersection-cleared', (e) => {
      const isGrabbing = this.el.components['super-hands'] && 
                         this.el.components['super-hands'].state.includes('grab');
      if (!isGrabbing) {
        this.hideLaser();
      }
    });

    // Show laser on grip/trigger press
    this.el.addEventListener('grip-down', () => this.showLaser());
    this.el.addEventListener('trigger-down', () => this.showLaser());

    // Hide laser on grip/trigger release
    this.el.addEventListener('grip-up', () => this.hideLaser());
    this.el.addEventListener('trigger-up', () => this.hideLaser());
  },

  showLaser: function() {
    this.el.setAttribute('line', 'visible', true);
    this.el.setAttribute('line', 'opacity', 0.8);
  },

  hideLaser: function() {
    this.el.setAttribute('line', 'visible', false);
    this.el.setAttribute('line', 'opacity', 0);
  }
});
