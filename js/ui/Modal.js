class Modal extends EventEmitter {
  constructor(id, options = {}) {
    super();
    this.id = id;
    this.element = null;
    this.isVisible = false;
    this.options = {
      closeOnEscape: true,
      closeOnOverlay: true,
      showCloseButton: true,
      animation: "fadeIn",
      backdrop: true,
      destroyOnClose: false,
      persistent: false,
      ...options,
    };

    this.keydownHandler = null;
    this.clickHandler = null;
    this.resizeHandler = null;

    this.init();
  }

  init() {
    this.element = document.getElementById(this.id);
    if (!this.element) {
      console.warn(`Modal element with id "${this.id}" not found`);
      return;
    }

    this.setupEventListeners();
    this.setupCloseButtons();
    this.emit("initialized", this.id);

    console.log(`✅ Modal ${this.id} инициализирован`);
  }

  setupEventListeners() {
    this.keydownHandler = (e) => {
      if (this.isVisible && this.options.closeOnEscape && e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    };

    this.clickHandler = (e) => {
      if (
        this.isVisible &&
        this.options.closeOnOverlay &&
        e.target === this.element &&
        this.element.classList.contains("modal-overlay")
      ) {
        this.close();
      }
    };

    this.resizeHandler = () => {
      if (this.isVisible) {
        this.centerModal();
      }
    };

    document.addEventListener("keydown", this.keydownHandler);
    this.element.addEventListener("click", this.clickHandler);
    window.addEventListener("resize", this.resizeHandler);
  }

  setupCloseButtons() {
    if (!this.element) return;

    const closeButtons = this.element.querySelectorAll(
      ".close-button, [data-modal-close]"
    );

    closeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        this.close();
      });
    });
  }

  show(data = null) {
    if (!this.element) {
      console.warn(`Cannot show modal ${this.id}: element not found`);
      return false;
    }

    if (this.isVisible) {
      return true;
    }

    this.emit("beforeShow", { id: this.id, data });

    this.element.classList.add("active");

    if (this.options.animation) {
      this.element.style.animation = `${this.options.animation} 0.3s ease-out`;
    }

    this.centerModal();

    this.setFocus();

    if (this.options.backdrop) {
      this.disableBodyScroll();
    }

    this.isVisible = true;
    this.emit("shown", { id: this.id, data });

    return true;
  }

  close() {
    if (!this.element || !this.isVisible) {
      return false;
    }

    if (this.options.persistent) {
      this.shake();
      return false;
    }

    this.emit("beforeClose", { id: this.id });

    if (this.options.animation) {
      this.element.style.animation = `fadeOut 0.3s ease-out`;

      setTimeout(() => {
        this.element.classList.remove("active");
        this.element.style.animation = "";
      }, 300);
    } else {
      this.element.classList.remove("active");
    }

    this.enableBodyScroll();

    this.restoreFocus();

    this.isVisible = false;
    this.emit("closed", { id: this.id });

    if (this.options.destroyOnClose) {
      this.destroy();
    }

    return true;
  }

  toggle(data = null) {
    return this.isVisible ? this.close() : this.show(data);
  }

  centerModal() {
    if (!this.element) return;

    const modalContent = this.element.querySelector(".modal-content");
    if (!modalContent) return;

    modalContent.style.marginTop = "";
    modalContent.style.marginLeft = "";

    const rect = modalContent.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    if (rect.height < windowHeight) {
      const topMargin = Math.max(0, (windowHeight - rect.height) / 2);
      modalContent.style.marginTop = `${topMargin}px`;
    }

    if (rect.width < windowWidth) {
      const leftMargin = Math.max(0, (windowWidth - rect.width) / 2);
      modalContent.style.marginLeft = `${leftMargin}px`;
    }
  }

  setFocus() {
    if (!this.element) return;

    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      this.element.focus();
    }
  }

  restoreFocus() {
    if (this.previousActiveElement && this.previousActiveElement.focus) {
      this.previousActiveElement.focus();
    }
  }

  shake() {
    if (!this.element) return;

    const modalContent = this.element.querySelector(".modal-content");
    if (!modalContent) return;

    modalContent.style.animation = "shake 0.5s ease-in-out";

    setTimeout(() => {
      modalContent.style.animation = "";
    }, 500);

    this.emit("shake", { id: this.id });
  }

  disableBodyScroll() {
    this.scrollPosition = window.pageYOffset;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${this.scrollPosition}px`;
    document.body.style.width = "100%";
  }

  enableBodyScroll() {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";

    if (this.scrollPosition !== undefined) {
      window.scrollTo(0, this.scrollPosition);
    }
  }

  setContent(content) {
    if (!this.element) return false;

    const modalBody = this.element.querySelector(".modal-body");
    const modalContent = this.element.querySelector(".modal-content");

    const target = modalBody || modalContent;

    if (target) {
      if (typeof content === "string") {
        target.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        target.innerHTML = "";
        target.appendChild(content);
      }

      this.emit("contentChanged", { id: this.id, content });
      return true;
    }

    return false;
  }

  setTitle(title) {
    if (!this.element) return false;

    const titleElement = this.element.querySelector(
      ".modal-title, .modal-header h2"
    );

    if (titleElement) {
      titleElement.textContent = title;
      this.emit("titleChanged", { id: this.id, title });
      return true;
    }

    return false;
  }

  addButton(text, callback, className = "") {
    if (!this.element) return null;

    let footer = this.element.querySelector(".modal-footer");

    if (!footer) {
      footer = document.createElement("div");
      footer.className = "modal-footer";

      const modalContent = this.element.querySelector(".modal-content");
      if (modalContent) {
        modalContent.appendChild(footer);
      }
    }

    const button = document.createElement("button");
    button.className = `modal-button ${className}`;
    button.textContent = text;

    button.addEventListener("click", (e) => {
      e.preventDefault();
      if (callback) {
        callback(this, e);
      }
    });

    footer.appendChild(button);
    return button;
  }

  removeButton(button) {
    if (button && button.parentNode) {
      button.parentNode.removeChild(button);
      return true;
    }
    return false;
  }

  enablePersistent() {
    this.options.persistent = true;
  }

  disablePersistent() {
    this.options.persistent = false;
  }

  setSize(size) {
    if (!this.element) return;

    const modalContent = this.element.querySelector(".modal-content");
    if (!modalContent) return;

    modalContent.classList.remove(
      "modal-sm",
      "modal-lg",
      "modal-xl",
      "modal-fullscreen"
    );

    if (size && size !== "default") {
      modalContent.classList.add(`modal-${size}`);
    }

    this.centerModal();
    this.emit("sizeChanged", { id: this.id, size });
  }

  startLoading(message = "Загрузка...") {
    if (!this.element) return;

    let loadingOverlay = this.element.querySelector(".modal-loading-overlay");

    if (!loadingOverlay) {
      loadingOverlay = document.createElement("div");
      loadingOverlay.className = "modal-loading-overlay";
      loadingOverlay.innerHTML = `
        <div class="modal-loading-content">
          <div class="loading-indicator"></div>
          <div class="loading-message">${message}</div>
        </div>
      `;

      this.element.appendChild(loadingOverlay);
    } else {
      const messageEl = loadingOverlay.querySelector(".loading-message");
      if (messageEl) {
        messageEl.textContent = message;
      }
    }

    loadingOverlay.style.display = "flex";
    this.emit("loadingStarted", { id: this.id, message });
  }

  stopLoading() {
    if (!this.element) return;

    const loadingOverlay = this.element.querySelector(".modal-loading-overlay");
    if (loadingOverlay) {
      loadingOverlay.style.display = "none";
    }

    this.emit("loadingStopped", { id: this.id });
  }

  showProgress(percentage, message = "") {
    if (!this.element) return;

    let progressOverlay = this.element.querySelector(".modal-progress-overlay");

    if (!progressOverlay) {
      progressOverlay = document.createElement("div");
      progressOverlay.className = "modal-progress-overlay";
      progressOverlay.innerHTML = `
        <div class="modal-progress-content">
          <div class="progress-message"></div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-percentage"></div>
        </div>
      `;

      this.element.appendChild(progressOverlay);
    }

    const messageEl = progressOverlay.querySelector(".progress-message");
    const fillEl = progressOverlay.querySelector(".progress-fill");
    const percentageEl = progressOverlay.querySelector(".progress-percentage");

    if (messageEl) messageEl.textContent = message;
    if (fillEl)
      fillEl.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    if (percentageEl) percentageEl.textContent = `${Math.round(percentage)}%`;

    progressOverlay.style.display = "flex";
    this.emit("progressShown", { id: this.id, percentage, message });
  }

  hideProgress() {
    if (!this.element) return;

    const progressOverlay = this.element.querySelector(
      ".modal-progress-overlay"
    );
    if (progressOverlay) {
      progressOverlay.style.display = "none";
    }

    this.emit("progressHidden", { id: this.id });
  }

  destroy() {
    if (this.isVisible) {
      this.close();
    }

    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
    }

    if (this.clickHandler && this.element) {
      this.element.removeEventListener("click", this.clickHandler);
    }

    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }

    this.removeAllListeners();

    if (
      this.options.destroyOnClose &&
      this.element &&
      this.element.parentNode
    ) {
      this.element.parentNode.removeChild(this.element);
    }

    this.element = null;
    this.emit("destroyed", { id: this.id });

    console.log(`🗑️ Modal ${this.id} уничтожен`);
  }

  static create(id, options = {}) {
    return new Modal(id, options);
  }

  static createFromTemplate(template, options = {}) {
    const modalId = `modal-${Date.now()}`;
    const modalElement = document.createElement("div");
    modalElement.id = modalId;
    modalElement.className = "modal-overlay";
    modalElement.innerHTML = template;

    document.body.appendChild(modalElement);

    return new Modal(modalId, { ...options, destroyOnClose: true });
  }

  static showAlert(message, title = "Внимание", options = {}) {
    const template = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="close-button">✖️</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="modal-button" data-modal-close>OK</button>
        </div>
      </div>
    `;

    const modal = Modal.createFromTemplate(template, options);
    modal.show();
    return modal;
  }

  static showConfirm(message, title = "Подтверждение", options = {}) {
    return new Promise((resolve) => {
      const template = `
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
            <button class="close-button">✖️</button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="modal-button modal-button-secondary" data-action="cancel">Отмена</button>
            <button class="modal-button modal-button-primary" data-action="confirm">OK</button>
          </div>
        </div>
      `;

      const modal = Modal.createFromTemplate(template, options);

      modal.element.addEventListener("click", (e) => {
        const action = e.target.getAttribute("data-action");
        if (action === "confirm") {
          resolve(true);
          modal.close();
        } else if (action === "cancel") {
          resolve(false);
          modal.close();
        }
      });

      modal.on("closed", () => {
        resolve(false);
      });

      modal.show();
    });
  }

  get visible() {
    return this.isVisible;
  }

  get content() {
    if (!this.element) return "";

    const modalBody = this.element.querySelector(".modal-body");
    return modalBody ? modalBody.innerHTML : "";
  }

  set content(value) {
    this.setContent(value);
  }

  get title() {
    if (!this.element) return "";

    const titleElement = this.element.querySelector(
      ".modal-title, .modal-header h2"
    );
    return titleElement ? titleElement.textContent : "";
  }

  set title(value) {
    this.setTitle(value);
  }
}
