class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   *
   * @param {string} event
   * @param {Function} listener
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   *
   * @param {string} event
   * @param {Function} listener
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
    return this;
  }

  /**
   *
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    if (!this.events[event]) return false;

    this.events[event].forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  /**
   *
   * @param {string} event
   * @param {Function} listenerToRemove
   */
  off(event, listenerToRemove) {
    if (!this.events[event]) return this;

    this.events[event] = this.events[event].filter(
      (listener) => listener !== listenerToRemove
    );

    if (this.events[event].length === 0) {
      delete this.events[event];
    }

    return this;
  }

  /**
   *
   * @param {string} [event]
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  /**
   *
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }

  /**
     
      @returns {string[]} 
     */
  eventNames() {
    return Object.keys(this.events);
  }
}
