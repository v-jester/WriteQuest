class StatusBar extends EventEmitter {
  constructor(editor) {
    super();
    this.editor = editor;
    this.element = null;
    this.items = new Map();
    this.updateInterval = null;
    this.isInitialized = false;

    this.init();
  }

  init() {
    this.element = document.getElementById("statusBar");
    if (!this.element) {
      throw new Error("StatusBar element not found");
    }

    this.setupStatusItems();
    this.bindEvents();
    this.startAutoUpdate();

    this.isInitialized = true;
    console.log("✅ StatusBar инициализирован");
  }

  setupStatusItems() {
    this.addStatusItem("wordCount", {
      element: document.getElementById("wordCount"),
      update: () => `Слов: ${this.editor.getWordCount()}`,
    });

    this.addStatusItem("charCount", {
      element: document.getElementById("charCount"),
      update: () => `Символов: ${this.editor.getCharacterCount()}`,
    });

    this.addStatusItem("readTime", {
      element: document.getElementById("readTime"),
      update: () => {
        const words = this.editor.getWordCount();
        const minutes = Math.max(1, Math.ceil(words / 200));
        return `Время чтения: ~${minutes} мин`;
      },
    });

    this.addStatusItem("currentMood", {
      element: document.getElementById("currentMood"),
      update: () => this.getCurrentMood(),
    });

    this.addStatusItem("connectionStatus", {
      element: document.getElementById("connectionStatus"),
      update: () => this.getConnectionStatus(),
    });

    this.addStatusItem("saveStatus", {
      element: document.getElementById("saveStatus"),
      update: () => this.getSaveStatus(),
    });

    this.addStatusItem("selection", {
      element: null,
      update: () => this.getSelectionInfo(),
      visible: false,
    });

    this.addStatusItem("position", {
      element: null,
      update: () => this.getCursorPosition(),
      visible: false,
    });

    this.addStatusItem("language", {
      element: null,
      update: () => this.getLanguageInfo(),
      visible: false,
    });
  }

  addStatusItem(id, config) {
    if (!config.element && config.visible !== false) {
      config.element = this.createElement(id);
    }

    this.items.set(id, {
      id,
      element: config.element,
      update: config.update,
      visible: config.visible !== false,
      config,
    });
  }

  createElement(id) {
    const span = document.createElement("span");
    span.id = id;
    span.className = "status-item";

    if (this.element) {
      this.element.appendChild(span);
    }

    return span;
  }

  bindEvents() {
    this.editor.on("wordCountChanged", () => {
      this.updateItem("wordCount");
      this.updateItem("charCount");
      this.updateItem("readTime");
    });

    this.editor.on("contentChanged", () => {
      this.updateItem("currentMood");
      this.updateItem("saveStatus");
    });

    this.editor.on("saved", () => {
      this.updateItem("saveStatus");
    });

    this.editor.on("autoSaved", () => {
      this.updateItem("saveStatus");
      this.showTemporaryMessage("Автосохранение", 2000);
    });

    document.addEventListener("selectionchange", () => {
      this.updateItem("selection");
      this.updateItem("position");
    });

    window.addEventListener("online", () => {
      this.updateItem("connectionStatus");
      this.showTemporaryMessage("Подключение восстановлено", 3000);
    });

    window.addEventListener("offline", () => {
      this.updateItem("connectionStatus");
      this.showTemporaryMessage("Нет подключения к интернету", 5000);
    });
  }

  startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.updateAll();
    }, 5000);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  updateItem(itemId) {
    const item = this.items.get(itemId);
    if (item && item.element && item.update && item.visible) {
      try {
        const content = item.update();
        if (content !== undefined && content !== null) {
          item.element.textContent = content;
        }
      } catch (error) {
        console.warn(`Error updating status item ${itemId}:`, error);
      }
    }
  }

  updateAll() {
    this.items.forEach((item, id) => {
      this.updateItem(id);
    });
  }

  getCurrentMood() {
    const text = this.editor.getContent();
    if (!text.trim()) {
      return "Настроение: N/A";
    }

    const positiveWords = [
      "хорошо",
      "отлично",
      "прекрасно",
      "замечательно",
      "радость",
      "счастье",
      "любовь",
    ];
    const negativeWords = [
      "плохо",
      "ужасно",
      "грустно",
      "печаль",
      "злость",
      "ненависть",
      "боль",
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach((word) => {
      if (positiveWords.some((pw) => word.includes(pw))) positiveCount++;
      if (negativeWords.some((nw) => word.includes(nw))) negativeCount++;
    });

    let mood = "Нейтральное";
    if (positiveCount > negativeCount) {
      mood = "Позитивное";
    } else if (negativeCount > positiveCount) {
      mood = "Негативное";
    }

    return `Настроение: ${mood}`;
  }

  getConnectionStatus() {
    const isOnline = navigator.onLine;
    return `Подключение: ${isOnline ? "✅" : "❌"}`;
  }

  getSaveStatus() {
    if (this.editor.hasUnsavedChanges()) {
      return "Не сохранено";
    }
    return "Сохранено";
  }

  getSelectionInfo() {
    const selectionInfo = this.editor.getSelectionInfo();
    if (selectionInfo.hasSelection) {
      return `Выделено: ${selectionInfo.length} симв. (${selectionInfo.wordCount} слов)`;
    }
    return "";
  }

  getCursorPosition() {
    if (!this.editor.selectionManager) return "";

    const position = this.editor.selectionManager.getCursorPosition();
    const text = this.editor.getContent();
    const lines = text.substring(0, position).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return `Стр ${line}, Кол ${column}`;
  }

  getLanguageInfo() {
    const text = this.editor.getContent();
    if (!text.trim()) return "Язык: N/A";

    const russianChars = (text.match(/[а-яё]/gi) || []).length;
    const englishChars = (text.match(/[a-z]/gi) || []).length;
    const totalChars = russianChars + englishChars;

    if (totalChars === 0) return "Язык: N/A";

    const russianPercent = (russianChars / totalChars) * 100;

    if (russianPercent > 70) {
      return "Язык: Русский";
    } else if (russianPercent < 30) {
      return "Язык: English";
    } else {
      return "Язык: Смешанный";
    }
  }

  showItem(itemId) {
    const item = this.items.get(itemId);
    if (item) {
      item.visible = true;
      if (item.element) {
        item.element.style.display = "flex";
      }
      this.updateItem(itemId);
    }
  }

  hideItem(itemId) {
    const item = this.items.get(itemId);
    if (item) {
      item.visible = false;
      if (item.element) {
        item.element.style.display = "none";
      }
    }
  }

  toggleItem(itemId) {
    const item = this.items.get(itemId);
    if (item) {
      if (item.visible) {
        this.hideItem(itemId);
      } else {
        this.showItem(itemId);
      }
    }
  }

  showTemporaryMessage(message, duration = 3000) {
    const tempItem = document.createElement("span");
    tempItem.className = "status-item temp-message";
    tempItem.textContent = message;
    tempItem.style.cssText = `
      color: var(--primary);
      font-weight: 600;
      animation: fadeIn 0.3s ease-in;
    `;

    if (this.element) {
      this.element.appendChild(tempItem);
    }

    setTimeout(() => {
      if (tempItem.parentNode) {
        tempItem.style.animation = "fadeOut 0.3s ease-out";
        setTimeout(() => {
          if (tempItem.parentNode) {
            tempItem.parentNode.removeChild(tempItem);
          }
        }, 300);
      }
    }, duration);

    this.emit("temporaryMessage", { message, duration });
  }

  showProgress(percentage, message = "") {
    let progressBar = document.getElementById("statusProgress");

    if (!progressBar) {
      progressBar = document.createElement("div");
      progressBar.id = "statusProgress";
      progressBar.className = "status-progress";
      progressBar.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <span class="progress-text"></span>
      `;

      if (this.element) {
        this.element.appendChild(progressBar);
      }
    }

    const fill = progressBar.querySelector(".progress-fill");
    const text = progressBar.querySelector(".progress-text");

    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }

    if (text) {
      text.textContent = message;
    }

    progressBar.style.display = "flex";
  }

  hideProgress() {
    const progressBar = document.getElementById("statusProgress");
    if (progressBar) {
      progressBar.style.display = "none";
    }
  }

  addCustomItem(id, config) {
    const element = this.createElement(id);
    this.addStatusItem(id, {
      element,
      update: config.update,
      visible: config.visible !== false,
    });

    this.updateItem(id);
    return element;
  }

  removeItem(itemId) {
    const item = this.items.get(itemId);
    if (item && item.element) {
      item.element.remove();
      this.items.delete(itemId);
    }
  }

  applyTheme(theme) {
    if (this.element) {
      this.element.className = `status-bar theme-${theme}`;
      this.emit("themeChanged", theme);
    }
  }

  getStatistics() {
    const stats = {};
    this.items.forEach((item, id) => {
      if (item.update && item.visible) {
        try {
          stats[id] = item.update();
        } catch (error) {
          stats[id] = "N/A";
        }
      }
    });
    return stats;
  }

  destroy() {
    this.stopAutoUpdate();

    this.items.forEach((item, id) => {
      if (item.element && item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });

    this.items.clear();
    this.removeAllListeners();
    this.isInitialized = false;
  }
}
