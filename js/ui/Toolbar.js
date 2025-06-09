class Toolbar extends EventEmitter {
  constructor(editor) {
    super();
    this.editor = editor;
    this.buttons = new Map();
    this.isInitialized = false;

    this.init();
  }

  init() {
    this.setupButtons();
    this.bindEvents();
    this.updateButtonStates();
    this.isInitialized = true;

    console.log("✅ Toolbar инициализирован");
  }

  setupButtons() {
    this.addButton("undoButton", {
      icon: "↩️",
      text: "UNDO",
      title: "Отменить (Ctrl+Z)",
      action: () => this.editor.undo(),
      enabled: () => this.editor.commandManager.canUndo(),
    });

    this.addButton("redoButton", {
      icon: "↪️",
      text: "REDO",
      title: "Повторить (Ctrl+Y)",
      action: () => this.editor.redo(),
      enabled: () => this.editor.commandManager.canRedo(),
    });

    this.addButton("saveButton", {
      icon: "💾",
      text: "SAVE",
      title: "Сохранить (Ctrl+S)",
      action: () => this.saveDocument(),
    });

    this.addButton("loadButton", {
      icon: "📂",
      text: "LOAD",
      title: "Загрузить (Ctrl+O)",
      action: () => this.loadDocument(),
    });

    this.addButton("aiImproveButton", {
      icon: "✨",
      text: "AI_IMPROVE",
      title: "Улучшить текст (Ctrl+I)",
      action: () => this.editor.improveText(),
      className: "ai-button",
    });

    this.addButton("aiCompleteButton", {
      icon: "🧠",
      text: "AI_COMPLETE",
      title: "Автодополнение (Ctrl+Space)",
      action: () => this.editor.completeText(),
      className: "ai-button",
    });

    this.addButton("aiSentimentButton", {
      icon: "📊",
      text: "SENTIMENT",
      title: "Анализ настроения",
      action: () => this.editor.analyzeSentiment(),
      className: "ai-button",
    });

    this.addButton("helpButton", {
      icon: "❓",
      text: "HELP",
      title: "Справка (F1)",
      action: () => this.showHelp(),
    });

    this.addButton("settingsButton", {
      icon: "⚙️",
      text: "SETTINGS",
      title: "Настройки (Ctrl+,)",
      action: () => this.showSettings(),
      className: "settings-button",
    });
  }

  addButton(id, config) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Button element ${id} not found`);
      return;
    }

    const button = {
      element,
      config,
      id,
    };

    if (config.icon && config.text) {
      element.innerHTML = `${config.icon} ${config.text}`;
    }

    if (config.title) {
      element.title = config.title;
    }

    if (config.className) {
      element.classList.add(config.className);
    }

    this.buttons.set(id, button);
  }

  bindEvents() {
    this.buttons.forEach((button, id) => {
      if (button.config.action) {
        button.element.addEventListener("click", (e) => {
          e.preventDefault();
          if (!button.element.disabled) {
            button.config.action();
            this.emit("buttonClick", id);
          }
        });
      }
    });

    if (this.editor.commandManager) {
      this.editor.commandManager.on("historyChanged", () => {
        this.updateButtonStates();
      });
    }

    document.addEventListener("selectionchange", () => {
      this.updateFormatButtons();
    });
  }

  updateButtonStates() {
    this.buttons.forEach((button, id) => {
      if (button.config.enabled) {
        const enabled = button.config.enabled();
        button.element.disabled = !enabled;

        if (enabled) {
          button.element.classList.remove("disabled");
        } else {
          button.element.classList.add("disabled");
        }
      }
    });
  }

  updateFormatButtons() {
    const formatButtons = ["boldButton", "italicButton", "underlineButton"];

    formatButtons.forEach((buttonId) => {
      const button = this.buttons.get(buttonId);
      if (button) {
        const command = buttonId.replace("Button", "");
        const isActive = document.queryCommandState(command);

        if (isActive) {
          button.element.classList.add("active");
        } else {
          button.element.classList.remove("active");
        }
      }
    });
  }

  saveDocument() {
    try {
      const content = this.editor.getContent();
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `document-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.editor.markAsSaved();
      window.showNotification("Документ сохранен", "success");

      this.emit("documentSaved");
    } catch (error) {
      console.error("Save error:", error);
      window.showNotification("Ошибка сохранения документа", "error");
    }
  }

  loadDocument() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.doc,.docx";

    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const content = await this.readFile(file);
        this.editor.setContent(content);
        this.editor.markAsSaved();
        window.showNotification(`Документ "${file.name}" загружен`, "success");

        this.emit("documentLoaded", file.name);
      } catch (error) {
        console.error("Load error:", error);
        window.showNotification("Ошибка загрузки документа", "error");
      }
    });

    input.click();
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsText(file, "UTF-8");
    });
  }

  showHelp() {
    const modal = document.getElementById("helpModal");
    if (modal) {
      modal.classList.add("active");
      this.emit("helpShown");
    }
  }

  showSettings() {
    const modal = document.getElementById("settingsModal");
    if (modal) {
      this.loadSettingsToModal();
      modal.classList.add("active");
      this.emit("settingsShown");
    }
  }

  loadSettingsToModal() {
    if (!this.editor.gameManager) return;

    const settings = this.editor.gameManager.settings;

    const autoSaveToggle = document.getElementById("autoSaveToggle");
    const notificationsToggle = document.getElementById("notificationsToggle");
    const dailyWordTarget = document.getElementById("dailyWordTarget");
    const difficultySelect = document.getElementById("difficultySelect");

    if (autoSaveToggle) autoSaveToggle.checked = settings.autoSave;
    if (notificationsToggle)
      notificationsToggle.checked = settings.notifications;
    if (dailyWordTarget) dailyWordTarget.value = settings.dailyWordTarget;
    if (difficultySelect) difficultySelect.value = settings.difficulty;
  }

  enableButton(buttonId) {
    const button = this.buttons.get(buttonId);
    if (button) {
      button.element.disabled = false;
      button.element.classList.remove("disabled");
    }
  }

  disableButton(buttonId) {
    const button = this.buttons.get(buttonId);
    if (button) {
      button.element.disabled = true;
      button.element.classList.add("disabled");
    }
  }

  toggleButton(buttonId, active) {
    const button = this.buttons.get(buttonId);
    if (button) {
      if (active) {
        button.element.classList.add("active");
      } else {
        button.element.classList.remove("active");
      }
    }
  }

  addCustomButton(id, config, position = "end") {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;

    const button = document.createElement("button");
    button.id = id;
    button.className = "tool-button";
    button.innerHTML = `${config.icon} ${config.text}`;
    button.title = config.title || "";

    if (config.className) {
      button.classList.add(config.className);
    }

    if (position === "start") {
      toolbar.insertBefore(button, toolbar.firstChild);
    } else {
      toolbar.appendChild(button);
    }

    this.addButton(id, config);

    if (config.action) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        if (!button.disabled) {
          config.action();
          this.emit("buttonClick", id);
        }
      });
    }

    return button;
  }

  removeButton(buttonId) {
    const button = this.buttons.get(buttonId);
    if (button && button.element) {
      button.element.remove();
      this.buttons.delete(buttonId);
    }
  }

  addDivider(position = "end") {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;

    const divider = document.createElement("div");
    divider.className = "divider";

    if (position === "start") {
      toolbar.insertBefore(divider, toolbar.firstChild);
    } else {
      toolbar.appendChild(divider);
    }

    return divider;
  }

  getButton(buttonId) {
    return this.buttons.get(buttonId);
  }

  getAllButtons() {
    return Array.from(this.buttons.values());
  }

  updateButtonText(buttonId, text) {
    const button = this.buttons.get(buttonId);
    if (button && button.config.icon) {
      button.element.innerHTML = `${button.config.icon} ${text}`;
      button.config.text = text;
    }
  }

  updateButtonIcon(buttonId, icon) {
    const button = this.buttons.get(buttonId);
    if (button && button.config.text) {
      button.element.innerHTML = `${icon} ${button.config.text}`;
      button.config.icon = icon;
    }
  }

  show() {
    const toolbar = document.getElementById("toolbar");
    if (toolbar) {
      toolbar.style.display = "flex";
    }
  }

  hide() {
    const toolbar = document.getElementById("toolbar");
    if (toolbar) {
      toolbar.style.display = "none";
    }
  }

  toggleCompactMode(compact = true) {
    const toolbar = document.getElementById("toolbar");
    if (toolbar) {
      if (compact) {
        toolbar.classList.add("compact");

        this.buttons.forEach((button) => {
          if (button.config.icon && button.config.text) {
            button.element.innerHTML = button.config.icon;
          }
        });
      } else {
        toolbar.classList.remove("compact");
        this.buttons.forEach((button) => {
          if (button.config.icon && button.config.text) {
            button.element.innerHTML = `${button.config.icon} ${button.config.text}`;
          }
        });
      }
    }
  }

  applyTheme(theme) {
    const toolbar = document.getElementById("toolbar");
    if (toolbar) {
      toolbar.className = `toolbar theme-${theme}`;
      this.emit("themeChanged", theme);
    }
  }

  destroy() {
    this.buttons.forEach((button, id) => {
      if (button.element) {
        button.element.removeEventListener("click", button.config.action);
      }
    });

    this.buttons.clear();
    this.removeAllListeners();
    this.isInitialized = false;
  }
}
