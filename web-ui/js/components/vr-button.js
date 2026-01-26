/**
 * VR Button Component
 * A reusable button that shades on trigger press and fires action on trigger release
 */
AFRAME.registerComponent('vr-button', {
  schema: {
    width: { type: 'number', default: 0.15 },
    height: { type: 'number', default: 0.06 },
    color: { type: 'color', default: '#4CAF50' },
    hoverColor: { type: 'color', default: '#66BB6A' },
    pressedColor: { type: 'color', default: '#2E7D32' },
    text: { type: 'string', default: 'Button' },
    textColor: { type: 'color', default: '#ffffff' },
    textWidth: { type: 'number', default: 0.3 },
    disabled: { type: 'boolean', default: false }
  },

  init: function() {
    this.isHovered = false;
    this.isPressed = false;
    this.baseColor = this.data.color;
    
    // Bind methods
    this.onTriggerDown = this.onTriggerDown.bind(this);
    this.onTriggerUp = this.onTriggerUp.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    
    this.createButton();
    this.addEventListeners();
  },

  createButton: function() {
    const { width, height, color, text, textColor, textWidth } = this.data;
    
    // Button background
    this.el.setAttribute('geometry', {
      primitive: 'plane',
      width: width,
      height: height
    });
    this.el.setAttribute('material', {
      color: color,
      opacity: 0.9,
      shader: 'flat'
    });
    this.el.classList.add('clickable');
    
    // Button text
    this.buttonText = document.createElement('a-text');
    this.buttonText.setAttribute('value', text);
    this.buttonText.setAttribute('align', 'center');
    this.buttonText.setAttribute('position', '0 0 0.005');
    this.buttonText.setAttribute('width', textWidth);
    this.buttonText.setAttribute('color', textColor);
    this.el.appendChild(this.buttonText);
  },

  addEventListeners: function() {
    // VR controller trigger events
    this.el.addEventListener('triggerdown', this.onTriggerDown);
    this.el.addEventListener('triggerup', this.onTriggerUp);
    
    // Raycaster hover events
    this.el.addEventListener('raycaster-intersected', this.onMouseEnter);
    this.el.addEventListener('raycaster-intersected-cleared', this.onMouseLeave);
    
    // Mouse click fallback for non-VR
    this.el.addEventListener('click', this.onClick);
  },

  onMouseEnter: function(event) {
    if (this.data.disabled) return;
    
    this.isHovered = true;
    this.hoveringRaycaster = event.detail.el;
    
    // Listen for trigger events on the controller
    if (this.hoveringRaycaster) {
      this.hoveringRaycaster.addEventListener('triggerdown', this.onTriggerDown);
      this.hoveringRaycaster.addEventListener('triggerup', this.onTriggerUp);
    }
    
    if (!this.isPressed) {
      this.el.setAttribute('material', 'color', this.data.hoverColor);
      this.el.setAttribute('scale', '1.05 1.05 1.05');
    }
  },

  onMouseLeave: function(event) {
    this.isHovered = false;
    
    // Remove trigger listeners from the controller
    if (this.hoveringRaycaster) {
      this.hoveringRaycaster.removeEventListener('triggerdown', this.onTriggerDown);
      this.hoveringRaycaster.removeEventListener('triggerup', this.onTriggerUp);
      this.hoveringRaycaster = null;
    }
    
    // Reset if we leave while pressed (cancel the action)
    if (this.isPressed) {
      this.isPressed = false;
    }
    
    this.el.setAttribute('material', 'color', this.baseColor);
    this.el.setAttribute('scale', '1 1 1');
  },

  onTriggerDown: function(event) {
    if (this.data.disabled || !this.isHovered) return;
    
    event.stopPropagation();
    this.isPressed = true;
    
    // Visual feedback - darken the button
    this.el.setAttribute('material', 'color', this.data.pressedColor);
    this.el.setAttribute('scale', '0.95 0.95 0.95');
  },

  onTriggerUp: function(event) {
    if (this.data.disabled) return;
    
    // Only fire action if we're still hovered and were pressed
    if (this.isPressed && this.isHovered) {
      event.stopPropagation();
      
      // Fire the action event
      this.el.emit('button-action', { button: this.el }, false);
    }
    
    this.isPressed = false;
    
    // Return to hover state if still hovered
    if (this.isHovered) {
      this.el.setAttribute('material', 'color', this.data.hoverColor);
      this.el.setAttribute('scale', '1.05 1.05 1.05');
    } else {
      this.el.setAttribute('material', 'color', this.baseColor);
      this.el.setAttribute('scale', '1 1 1');
    }
  },

  onClick: function(event) {
    // Mouse click fallback for non-VR usage
    if (this.data.disabled) return;
    
    event.stopPropagation();
    this.el.emit('button-action', { button: this.el }, false);
  },

  update: function(oldData) {
    // Update text if changed
    if (oldData.text !== this.data.text && this.buttonText) {
      this.buttonText.setAttribute('value', this.data.text);
    }
    
    // Update base color if changed
    if (oldData.color !== this.data.color) {
      this.baseColor = this.data.color;
      if (!this.isHovered && !this.isPressed) {
        this.el.setAttribute('material', 'color', this.baseColor);
      }
    }
    
    // Update text color if changed
    if (oldData.textColor !== this.data.textColor && this.buttonText) {
      this.buttonText.setAttribute('color', this.data.textColor);
    }
    
    // Handle disabled state
    if (this.data.disabled) {
      this.el.setAttribute('material', 'color', '#888888');
      this.el.setAttribute('scale', '1 1 1');
    }
  },

  // Public methods to update button state
  setText: function(text) {
    this.el.setAttribute('vr-button', 'text', text);
  },

  setColor: function(color) {
    this.el.setAttribute('vr-button', 'color', color);
  },

  setDisabled: function(disabled) {
    this.el.setAttribute('vr-button', 'disabled', disabled);
  },

  remove: function() {
    // Clean up event listeners
    this.el.removeEventListener('triggerdown', this.onTriggerDown);
    this.el.removeEventListener('triggerup', this.onTriggerUp);
    this.el.removeEventListener('raycaster-intersected', this.onMouseEnter);
    this.el.removeEventListener('raycaster-intersected-cleared', this.onMouseLeave);
    this.el.removeEventListener('click', this.onClick);
    
    if (this.hoveringRaycaster) {
      this.hoveringRaycaster.removeEventListener('triggerdown', this.onTriggerDown);
      this.hoveringRaycaster.removeEventListener('triggerup', this.onTriggerUp);
    }
    
    if (this.buttonText && this.buttonText.parentNode) {
      this.buttonText.parentNode.removeChild(this.buttonText);
    }
  }
});
