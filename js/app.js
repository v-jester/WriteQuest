class WriterQuestApp {
  constructor() {
    this.editor = null;
    this.isInitialized = false;
    this.version = "1.0.0";

    this.config = {
      autoSaveInterval: 30000,
      maxHistorySize: 100,
      debugMode: false,
      features: {
        ai: true,
        achievements: true,
        quests: true,
        statistics: true,
      },
    };

    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.start());
    } else {
      this.start();
    }
  }

  async start() {
    try {
      this.log("🚀 Запуск WriterQuest...");

      if (!this.checkBrowserSupport()) {
        this.showError("Ваш браузер не поддерживает все необходимые функции.");
        return;
      }

      this.showLoadingScreen();

      await this.initializeComponents();

      this.setupEventHandlers();

      this.hideLoadingScreen();

      this.isInitialized = true;
      this.log("✅ WriterQuest успешно инициализирован!");

      this.showWelcomeMessage();
    } catch (error) {
      console.error("❌ Ошибка инициализации WriterQuest:", error);
      this.showError(
        "Произошла ошибка при запуске приложения. Попробуйте обновить страницу."
      );
    }
  }

  async initializeComponents() {
    this.log("🔧 Инициализация компонентов...");

    try {
      this.editor = new TextEditor();

      await new Promise((resolve) => {
        if (this.editor.isReady) {
          resolve();
        } else {
          this.editor.on("ready", resolve);
        }
      });

      this.log("📝 Редактор инициализирован");
    } catch (error) {
      throw new Error(`Ошибка инициализации компонентов: ${error.message}`);
    }
  }

  setupEventHandlers() {
    document.addEventListener("keydown", (e) => this.handleGlobalKeydown(e));

    window.addEventListener("beforeunload", (e) => this.handleBeforeUnload(e));

    document.addEventListener("visibilitychange", () =>
      this.handleVisibilityChange()
    );

    window.addEventListener("error", (e) => this.handleGlobalError(e));
    window.addEventListener("unhandledrejection", (e) =>
      this.handleUnhandledRejection(e)
    );

    this.log("🎮 Обработчики событий настроены");
  }

  /**
   * @param {KeyboardEvent} e
   */
  handleGlobalKeydown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "s":
          e.preventDefault();
          this.saveDocument();
          break;
        case "o":
          e.preventDefault();
          this.loadDocument();
          break;
        case "e":
          e.preventDefault();
          this.exportStatistics();
          break;
        case "n":
          e.preventDefault();
          this.newDocument();
          break;
        case "/":
          e.preventDefault();
          this.showHelp();
          break;
      }
    }

    switch (e.key) {
      case "F1":
        e.preventDefault();
        this.showHelp();
        break;
      case "F11":
        e.preventDefault();
        this.toggleFullscreen();
        break;
    }
  }

  /**
   * @param {BeforeUnloadEvent} e
   */
  handleBeforeUnload(e) {
    if (this.editor && this.editor.hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue =
        "У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?";
      return e.returnValue;
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.log("🔇 Вкладка скрыта, приостанавливаем операции");
    } else {
      this.log("🔊 Вкладка активна, возобновляем операции");
      if (this.editor) {
        this.editor.focus();
      }
    }
  }

  /**
   * @param {ErrorEvent} e
   */
  handleGlobalError(e) {
    console.error("Global error:", e.error);
    this.showNotification(
      "Произошла ошибка. Данные автоматически сохранены.",
      "error"
    );

    if (this.editor) {
      this.editor.autoSave();
    }
  }

  /**
   * @param {PromiseRejectionEvent} e
   */
  handleUnhandledRejection(e) {
    console.error("Unhandled promise rejection:", e.reason);
    this.showNotification("Произошла неожиданная ошибка.", "warning");
  }

  newDocument() {
    if (!this.editor) return;

    if (this.editor.hasUnsavedChanges()) {
      if (
        !confirm("У вас есть несохраненные изменения. Создать новый документ?")
      ) {
        return;
      }
    }

    this.editor.clear();
    this.showNotification("Новый документ создан", "success");
  }

  saveDocument() {
    if (!this.editor) return;

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
      this.showNotification("Документ сохранен", "success");
    } catch (error) {
      console.error("Save error:", error);
      this.showNotification("Ошибка сохранения документа", "error");
    }
  }

  loadDocument() {
    if (!this.editor) return;

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
        this.showNotification(`Документ "${file.name}" загружен`, "success");
      } catch (error) {
        console.error("Load error:", error);
        this.showNotification("Ошибка загрузки документа", "error");
      }
    });

    input.click();
  }

  exportStatistics() {
    if (!this.editor) return;

    try {
      const stats = this.editor.gameManager.getStatistics();
      const userInfo = this.editor.gameManager.getUserInfo();
      const achievements = Array.from(
        this.editor.gameManager.achievements.entries()
      )
        .filter(([_, achievement]) => achievement.unlocked)
        .map(([id, achievement]) => ({
          id,
          name: achievement.name,
          description: achievement.description,
          unlockedAt: achievement.unlockedAt,
          xp: achievement.xp,
        }));

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: this.version,
        user: userInfo,
        statistics: stats,
        achievements,
        quests: this.editor.gameManager.quests.map((quest) => ({
          title: quest.title,
          description: quest.description,
          progress: quest.progress,
          target: quest.target,
          completed: quest.completed,
          xp: quest.xp,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `writer-quest-stats-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification("Статистика экспортирована", "success");
    } catch (error) {
      console.error("Export error:", error);
      this.showNotification("Ошибка экспорта статистики", "error");
    }
  }

  /**
   * @param {number} target
   */
  setDailyTarget(target) {
    if (!this.editor || target < 100 || target > 5000) {
      this.showNotification("Цель должна быть от 100 до 5000 слов", "warning");
      return;
    }

    this.editor.gameManager.updateSettings({ dailyWordTarget: target });
    this.showNotification(
      `Дневная цель установлена: ${target} слов`,
      "success"
    );
  }

  showHelp() {
    const helpContent = `
            <div class="help-content">
                <h3>🎮 WriterQuest - Помощь</h3>
                <h4>Горячие клавиши:</h4>
                <ul>
                    <li><kbd>Ctrl+S</kbd> - Сохранить документ</li>
                    <li><kbd>Ctrl+O</kbd> - Открыть документ</li>
                    <li><kbd>Ctrl+E</kbd> - Экспорт статистики</li>
                    <li><kbd>Ctrl+N</kbd> - Новый документ</li>
                    <li><kbd>Ctrl+B/I/U</kbd> - Форматирование</li>
                    <li><kbd>F1</kbd> - Показать помощь</li>
                    <li><kbd>F11</kbd> - Полноэкранный режим</li>
                </ul>
                <h4>Консольные команды:</h4>
                <ul>
                    <li><code>WriterQuest.save()</code> - Сохранить документ</li>
                    <li><code>WriterQuest.load()</code> - Загрузить документ</li>
                    <li><code>WriterQuest.export()</code> - Экспорт статистики</li>
                    <li><code>WriterQuest.setTarget(число)</code> - Установить цель</li>
                    <li><code>WriterQuest.debug.addWords(100)</code> - Добавить слова</li>
                </ul>
            </div>
        `;

    this.showModal("Справка", helpContent);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.showNotification("Полноэкранный режим включен", "info");
    } else {
      document.exitFullscreen();
      this.showNotification("Полноэкранный режим выключен", "info");
    }
  }

  resetProgress() {
    if (!this.editor) return;

    const confirmed = confirm(
      "Вы уверены, что хотите сбросить весь прогресс?\n\n" +
        "Это действие нельзя отменить. Все достижения, уровни и статистика будут потеряны."
    );

    if (confirmed) {
      const doubleConfirm = confirm(
        "Последнее предупреждение! Действительно сбросить ВСЕ данные?"
      );
      if (doubleConfirm) {
        this.editor.gameManager.resetProgress();
        this.showNotification(
          "Прогресс сброшен. Добро пожаловать в WriterQuest!",
          "success"
        );

        setTimeout(() => location.reload(), 2000);
      }
    }
  }

  closeAchievementModal() {
    const modal = document.getElementById("achievementModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  /**
   * @returns {boolean}
   */
  checkBrowserSupport() {
    const required = ["localStorage", "JSON", "Promise", "fetch"];

    return required.every((feature) => {
      const supported = window[feature] !== undefined;
      if (!supported) {
        console.warn(`Feature not supported: ${feature}`);
      }
      return supported;
    });
  }

  showLoadingScreen() {
    const loader = document.createElement("div");
    loader.id = "app-loader";
    loader.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✍️</div>
                    <div style="font-size: 24px; margin-bottom: 10px;">WriterQuest</div>
                    <div style="font-size: 14px; opacity: 0.8;">Загружаем ваше писательское приключение...</div>
                    <div style="margin-top: 20px;">
                        <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px;">
                            <div style="width: 0%; height: 100%; background: white; border-radius: 2px; animation: loading 2s ease-in-out infinite;"></div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes loading {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                }
            </style>
        `;
    document.body.appendChild(loader);
  }

  hideLoadingScreen() {
    const loader = document.getElementById("app-loader");
    if (loader) {
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.5s ease-out";
      setTimeout(() => loader.remove(), 500);
    }
  }

  showWelcomeMessage() {
    if (this.editor && this.editor.gameManager) {
      const userInfo = this.editor.gameManager.getUserInfo();
      const isFirstTime = userInfo.totalWords === 0;

      if (isFirstTime) {
        this.showNotification(
          "🎉 Добро пожаловать в WriterQuest! Начните писать, чтобы получить первое достижение.",
          "success",
          5000
        );
      } else {
        this.showNotification(
          `👋 С возвращением! Уровень ${userInfo.level}, ${userInfo.totalWords} слов написано.`,
          "info",
          3000
        );
      }
    }
  }

  /**
   * @param {string} message
   * @param {string} type
   * @param {number} duration
   */
  showNotification(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 14px;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
            transition: opacity 0.3s ease-out;
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => notification.remove(), 300);
    }, duration);

    notification.addEventListener("click", () => {
      notification.style.opacity = "0";
      setTimeout(() => notification.remove(), 300);
    });
  }

  /**
   * @param {string} title
   * @param {string} content
   */
  showModal(title, content) {
    const modal = document.createElement("div");
    modal.className = "custom-modal";
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

    modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #1f2937;">${title}</h2>
                    <button onclick="this.closest('.custom-modal').remove()" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #6b7280;
                    ">×</button>
                </div>
                <div>${content}</div>
            </div>
        `;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
  }

  /**
   * @param {string} message
   */
  showError(message) {
    this.showNotification(message, "error", 5000);
  }

  /**
   * @param {string} type
   * @returns {string}
   */
  getNotificationColor(type) {
    const colors = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#6366f1",
    };
    return colors[type] || colors.info;
  }

  /**
   * @param {File} file
   * @returns {Promise<string>}
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsText(file, "UTF-8");
    });
  }

  /**
   * @param {string} message
   */
  log(message) {
    if (this.config.debugMode) {
      console.log(`[WriterQuest] ${message}`);
    }
  }

  /**
   * @returns {TextEditor|null}
   */
  getEditor() {
    return this.editor;
  }

  /**
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.editor && this.editor.isReady;
  }

  /**
   * @returns {string}
   */
  getVersion() {
    return this.version;
  }

  /**
   *
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   *
   * @param {Object} newConfig
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log("Конфигурация обновлена");
  }
}

const app = new WriterQuestApp();

window.WriterQuest = {
  app: app,

  save: () => app.saveDocument(),
  load: () => app.loadDocument(),
  export: () => app.exportStatistics(),
  setTarget: (target) => app.setDailyTarget(target),
  help: () => app.showHelp(),
  fullscreen: () => app.toggleFullscreen(),

  version: () => app.getVersion(),
  config: () => app.getConfig(),
  ready: () => app.isReady(),

  debug: {
    addWords: (count) => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.addWords(count);
        app.showNotification(`Добавлено ${count} слов`, "success");
      }
    },
    addXP: (amount) => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.addXP(amount);
        app.showNotification(`Добавлено ${amount} XP`, "success");
      }
    },
    unlockAll: () => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.achievements.forEach((achievement, id) => {
          if (!achievement.unlocked) {
            app.editor.gameManager.unlockAchievement(id);
          }
        });
        app.showNotification("Все достижения разблокированы", "success");
      }
    },
    completeQuests: () => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.quests.forEach((quest) => {
          if (!quest.completed) {
            quest.progress = quest.target;
            quest.completed = true;
            app.editor.gameManager.addXP(quest.xp);
          }
        });
        app.editor.uiManager.updateQuests();
        app.showNotification("Все квесты завершены", "success");
      }
    },
    reset: () => app.resetProgress(),
    getStats: () => {
      if (app.editor && app.editor.gameManager) {
        return app.editor.gameManager.getStatistics();
      }
      return null;
    },
    setLevel: (level) => {
      if (app.editor && app.editor.gameManager && level > 0) {
        app.editor.gameManager.level = level;
        app.editor.uiManager.updateStats();
        app.showNotification(`Уровень установлен: ${level}`, "success");
      }
    },
    enableDebug: () => {
      app.updateConfig({ debugMode: true });
      app.showNotification("Debug режим включен", "info");
    },
  },
};

const additionalStyles = document.createElement("style");
additionalStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .help-content h3 {
        color: #1f2937;
        margin-bottom: 20px;
    }
    
    .help-content h4 {
        color: #374151;
        margin: 15px 0 10px 0;
    }
    
    .help-content ul {
        margin: 0 0 15px 20px;
    }
    
    .help-content li {
        margin-bottom: 5px;
    }
    
    .help-content kbd {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        padding: 2px 6px;
        font-family: monospace;
        font-size: 12px;
    }
    
    .help-content code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
    }
`;
document.head.appendChild(additionalStyles);

console.log(`
🎮 WriterQuest ${app.getVersion()} - Геймифицированный текстовый редактор

Доступные команды:
• WriterQuest.save() - сохранить документ
• WriterQuest.load() - загрузить документ  
• WriterQuest.export() - экспорт статистики
• WriterQuest.setTarget(число) - установить дневную цель
• WriterQuest.help() - показать справку

Горячие клавиши:
• Ctrl+S - сохранить | Ctrl+O - открыть | Ctrl+E - экспорт
• Ctrl+N - новый | F1 - справка | F11 - полный экран

Debug команды:
• WriterQuest.debug.addWords(100) - добавить слова
• WriterQuest.debug.unlockAll() - разблокировать достижения
• WriterQuest.debug.completeQuests() - завершить квесты
• WriterQuest.debug.reset() - сбросить прогресс

Удачного написания! ✍️
`);
