class WriterQuestApp {
  constructor() {
    this.editor = null;
    this.uiManager = null;
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
      this.hideLoadingScreen();
      this.showError(
        "Произошла ошибка при запуске приложения. Попробуйте обновить страницу."
      );
    }
  }

  async initializeComponents() {
    this.log("🔧 Инициализация компонентов...");

    try {
      // Проверяем наличие классов перед инициализацией
      if (typeof TextEditor !== "undefined") {
        this.editor = new TextEditor();

        await new Promise((resolve) => {
          if (this.editor.isReady) {
            resolve();
          } else {
            this.editor.on("ready", resolve);
          }
        });
      } else {
        // Заглушка для редактора, если класс не найден
        this.editor = this.createMockEditor();
      }

      this.log("📝 Редактор инициализирован");

      if (typeof UIManager !== "undefined") {
        this.uiManager = new UIManager(this.editor);
      } else {
        // Заглушка для UI менеджера
        this.uiManager = this.createMockUIManager();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      this.log("🎨 UI менеджер инициализирован");
    } catch (error) {
      throw new Error(`Ошибка инициализации компонентов: ${error.message}`);
    }
  }

  // Создаем заглушку для редактора
  createMockEditor() {
    return {
      isReady: true,
      content: "",
      unsavedChanges: false,
      gameManager: this.createMockGameManager(),

      getContent: () => this.editor.content,
      setContent: (content) => {
        this.editor.content = content;
      },
      clear: () => {
        this.editor.content = "";
      },
      hasUnsavedChanges: () => this.editor.unsavedChanges,
      markAsSaved: () => {
        this.editor.unsavedChanges = false;
      },
      autoSave: () => {
        this.log("Auto-save triggered");
      },
      focus: () => {
        this.log("Editor focused");
      },
      getWordCount: () =>
        this.editor.content.split(/\s+/).filter((word) => word.length > 0)
          .length,
      getCharacterCount: () => this.editor.content.length,
      on: (event, callback) => {
        if (event === "ready") {
          setTimeout(callback, 100);
        }
      },
    };
  }

  // Создаем заглушку для игрового менеджера
  createMockGameManager() {
    const gameManager = {
      level: 1,
      xp: 0,
      totalWords: 0,
      dailyWords: 0,
      achievements: [
        {
          id: "first_word",
          name: "Первое слово",
          description: "Напишите первое слово",
          unlocked: false,
          xp: 10,
        },
        {
          id: "hundred_words",
          name: "Сотня слов",
          description: "Напишите 100 слов",
          unlocked: false,
          xp: 50,
        },
        {
          id: "thousand_words",
          name: "Тысяча слов",
          description: "Напишите 1000 слов",
          unlocked: false,
          xp: 100,
        },
      ],
      quests: [
        {
          title: "Ежедневная цель",
          description: "Напишите 500 слов сегодня",
          progress: 0,
          target: 500,
          completed: false,
          xp: 100,
        },
      ],
      settings: { dailyWordTarget: 500 },

      getUserInfo: () => ({
        level: gameManager.level,
        xp: gameManager.xp,
        totalWords: gameManager.totalWords,
        dailyWords: gameManager.dailyWords,
      }),

      getStatistics: () => ({
        totalWords: gameManager.totalWords,
        dailyWords: gameManager.dailyWords,
        level: gameManager.level,
        xp: gameManager.xp,
        achievements: gameManager.achievements.filter((a) => a.unlocked).length,
        completedQuests: gameManager.quests.filter((q) => q.completed).length,
      }),

      addWords: (count) => {
        gameManager.totalWords += count;
        gameManager.dailyWords += count;
        gameManager.xp += count * 2;
        this.checkLevelUp();
        this.checkAchievements();
      },

      addXP: (amount) => {
        gameManager.xp += amount;
        this.checkLevelUp();
      },

      updateSettings: (newSettings) => {
        gameManager.settings = { ...gameManager.settings, ...newSettings };
      },

      resetProgress: () => {
        gameManager.level = 1;
        gameManager.xp = 0;
        gameManager.totalWords = 0;
        gameManager.dailyWords = 0;
        gameManager.achievements.forEach((a) => {
          a.unlocked = false;
        });
        gameManager.quests.forEach((q) => {
          q.progress = 0;
          q.completed = false;
        });
      },

      unlockAchievement: (id) => {
        const achievement = gameManager.achievements.find((a) => a.id === id);
        if (achievement && !achievement.unlocked) {
          achievement.unlocked = true;
          achievement.unlockedAt = new Date().toISOString();
          gameManager.xp += achievement.xp;
          this.log(`🏆 Достижение разблокировано: ${achievement.name}`);
        }
      },
    };

    // Методы для проверки достижений и уровня
    gameManager.checkLevelUp = () => {
      const newLevel = Math.floor(gameManager.xp / 1000) + 1;
      if (newLevel > gameManager.level) {
        gameManager.level = newLevel;
        if (this.uiManager) {
          this.uiManager.showNotification(
            `🎉 Новый уровень: ${newLevel}!`,
            "success"
          );
        }
      }
    };

    gameManager.checkAchievements = () => {
      const achievements = gameManager.achievements;

      if (
        gameManager.totalWords >= 1 &&
        !achievements.find((a) => a.id === "first_word").unlocked
      ) {
        gameManager.unlockAchievement("first_word");
      }
      if (
        gameManager.totalWords >= 100 &&
        !achievements.find((a) => a.id === "hundred_words").unlocked
      ) {
        gameManager.unlockAchievement("hundred_words");
      }
      if (
        gameManager.totalWords >= 1000 &&
        !achievements.find((a) => a.id === "thousand_words").unlocked
      ) {
        gameManager.unlockAchievement("thousand_words");
      }
    };

    return gameManager;
  }

  // Создаем заглушку для UI менеджера
  createMockUIManager() {
    return {
      showNotification: (message, type = "info", duration = 3000) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Простое уведомление через браузер
        if (window.Notification && Notification.permission === "granted") {
          new Notification("WriterQuest", { body: message });
        }
      },

      showError: (message) => {
        console.error(`[ERROR] ${message}`);
        alert(message);
      },

      showLoadingScreen: (message) => {
        this.log(`Loading: ${message}`);
      },

      hideLoadingScreen: () => {
        this.log("Loading complete");
      },

      showHelpModal: () => {
        alert(
          "Справка WriterQuest:\n\nГорячие клавиши:\n• Ctrl+S - сохранить\n• Ctrl+O - открыть\n• Ctrl+E - экспорт\n• F1 - справка"
        );
      },

      toggleFullscreen: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      },

      updateStats: () => {
        this.log("UI stats updated");
      },

      getUIStatistics: () => ({
        theme: "default",
        focusMode: false,
        compactMode: false,
      }),

      setTheme: (theme) => {
        document.body.className = `theme-${theme}`;
        this.log(`Theme changed to: ${theme}`);
      },

      toggleFocusMode: (enabled) => {
        document.body.classList.toggle("focus-mode", enabled);
        this.log(`Focus mode: ${enabled ? "enabled" : "disabled"}`);
      },

      toggleCompactMode: (enabled) => {
        document.body.classList.toggle("compact", enabled);
        this.log(`Compact mode: ${enabled ? "enabled" : "disabled"}`);
      },
    };
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

  handleGlobalError(e) {
    console.error("Global error:", e.error);
    if (this.uiManager) {
      this.uiManager.showNotification(
        "Произошла ошибка. Данные автоматически сохранены.",
        "error"
      );
    }

    if (this.editor) {
      this.editor.autoSave();
    }
  }

  handleUnhandledRejection(e) {
    console.error("Unhandled promise rejection:", e.reason);
    if (this.uiManager) {
      this.uiManager.showNotification(
        "Произошла неожиданная ошибка.",
        "warning"
      );
    }
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
    if (this.uiManager) {
      this.uiManager.showNotification("Новый документ создан", "success");
    }
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
      if (this.uiManager) {
        this.uiManager.showNotification("Документ сохранен", "success");
      }
    } catch (error) {
      console.error("Save error:", error);
      if (this.uiManager) {
        this.uiManager.showNotification("Ошибка сохранения документа", "error");
      }
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
        if (this.uiManager) {
          this.uiManager.showNotification(
            `Документ "${file.name}" загружен`,
            "success"
          );
        }
      } catch (error) {
        console.error("Load error:", error);
        if (this.uiManager) {
          this.uiManager.showNotification("Ошибка загрузки документа", "error");
        }
      }
    });

    input.click();
  }

  exportStatistics() {
    if (!this.editor) return;

    try {
      const stats = this.editor.gameManager.getStatistics();
      const userInfo = this.editor.gameManager.getUserInfo();
      const achievements = this.editor.gameManager.achievements
        .filter((achievement) => achievement.unlocked)
        .map((achievement) => ({
          id: achievement.id,
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
        ui: this.uiManager ? this.uiManager.getUIStatistics() : {},
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

      if (this.uiManager) {
        this.uiManager.showNotification("Статистика экспортирована", "success");
      }
    } catch (error) {
      console.error("Export error:", error);
      if (this.uiManager) {
        this.uiManager.showNotification("Ошибка экспорта статистики", "error");
      }
    }
  }

  setDailyTarget(target) {
    if (!this.editor || target < 100 || target > 5000) {
      if (this.uiManager) {
        this.uiManager.showNotification(
          "Цель должна быть от 100 до 5000 слов",
          "warning"
        );
      }
      return;
    }

    this.editor.gameManager.updateSettings({ dailyWordTarget: target });
    if (this.uiManager) {
      this.uiManager.showNotification(
        `Дневная цель установлена: ${target} слов`,
        "success"
      );
    }
  }

  showHelp() {
    if (this.uiManager) {
      this.uiManager.showHelpModal();
    }
  }

  toggleFullscreen() {
    if (this.uiManager) {
      this.uiManager.toggleFullscreen();
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
        if (this.uiManager) {
          this.uiManager.showNotification(
            "Прогресс сброшен. Добро пожаловать в WriterQuest!",
            "success"
          );
        }

        setTimeout(() => location.reload(), 2000);
      }
    }
  }

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
    if (this.uiManager) {
      this.uiManager.showLoadingScreen("LOADING INTERFACE...");
    } else {
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
  }

  hideLoadingScreen() {
    if (this.uiManager) {
      this.uiManager.hideLoadingScreen();
    } else {
      const loader = document.getElementById("app-loader");
      if (loader) {
        loader.style.opacity = "0";
        loader.style.transition = "opacity 0.5s ease-out";
        setTimeout(() => loader.remove(), 500);
      }
    }
  }

  showWelcomeMessage() {
    if (this.editor && this.editor.gameManager && this.uiManager) {
      const userInfo = this.editor.gameManager.getUserInfo();
      const isFirstTime = userInfo.totalWords === 0;

      if (isFirstTime) {
        this.uiManager.showNotification(
          "🎉 Добро пожаловать в WriterQuest! Начните писать, чтобы получить первое достижение.",
          "success",
          5000
        );
      } else {
        this.uiManager.showNotification(
          `👋 С возвращением! Уровень ${userInfo.level}, ${userInfo.totalWords} слов написано.`,
          "info",
          3000
        );
      }
    }
  }

  showError(message) {
    if (this.uiManager) {
      this.uiManager.showError(message);
    } else {
      alert(message);
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsText(file, "UTF-8");
    });
  }

  log(message) {
    if (this.config.debugMode) {
      console.log(`[WriterQuest] ${message}`);
    }
  }

  // Публичные методы
  getEditor() {
    return this.editor;
  }

  getUIManager() {
    return this.uiManager;
  }

  isReady() {
    return this.isInitialized && this.editor && this.editor.isReady;
  }

  getVersion() {
    return this.version;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log("Конфигурация обновлена");
  }

  // Методы для отладки
  enableDebugMode() {
    this.updateConfig({ debugMode: true });
    this.log("Debug режим включен");
  }

  disableDebugMode() {
    this.updateConfig({ debugMode: false });
  }

  getDebugInfo() {
    return {
      version: this.version,
      isReady: this.isReady(),
      config: this.config,
      editor: this.editor
        ? {
            wordCount: this.editor.getWordCount(),
            characterCount: this.editor.getCharacterCount(),
            hasUnsavedChanges: this.editor.hasUnsavedChanges(),
          }
        : null,
      gameManager:
        this.editor && this.editor.gameManager
          ? {
              level: this.editor.gameManager.level,
              xp: this.editor.gameManager.xp,
              totalWords: this.editor.gameManager.totalWords,
              dailyWords: this.editor.gameManager.dailyWords,
            }
          : null,
      ui: this.uiManager ? this.uiManager.getUIStatistics() : null,
    };
  }
}

// Инициализация приложения
const app = new WriterQuestApp();

// Глобальные объекты для доступа к API
window.app = app;

window.WriterQuest = {
  app: app,
  save: () => app.saveDocument(),
  load: () => app.loadDocument(),
  export: () => app.exportStatistics(),
  setTarget: (target) => app.setDailyTarget(target),
  help: () => app.showHelp(),
  fullscreen: () => app.toggleFullscreen(),
  new: () => app.newDocument(),

  version: () => app.getVersion(),
  config: () => app.getConfig(),
  ready: () => app.isReady(),
  info: () => app.getDebugInfo(),

  // Debug методы
  debug: {
    enable: () => app.enableDebugMode(),
    disable: () => app.disableDebugMode(),
    info: () => app.getDebugInfo(),

    addWords: (count) => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.addWords(count);
        if (app.uiManager) {
          app.uiManager.showNotification(`Добавлено ${count} слов`, "success");
        }
      }
    },

    addXP: (amount) => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.addXP(amount);
        if (app.uiManager) {
          app.uiManager.showNotification(`Добавлено ${amount} XP`, "success");
        }
      }
    },

    setLevel: (level) => {
      if (app.editor && app.editor.gameManager && level > 0) {
        app.editor.gameManager.level = level;
        if (app.uiManager) {
          app.uiManager.updateStats();
          app.uiManager.showNotification(
            `Уровень установлен: ${level}`,
            "success"
          );
        }
      }
    },

    unlockAll: () => {
      if (app.editor && app.editor.gameManager) {
        app.editor.gameManager.achievements.forEach((achievement) => {
          if (!achievement.unlocked) {
            app.editor.gameManager.unlockAchievement(achievement.id);
          }
        });
        if (app.uiManager) {
          app.uiManager.showNotification(
            "Все достижения разблокированы",
            "success"
          );
        }
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
        if (app.uiManager) {
          app.uiManager.updateStats();
          app.uiManager.showNotification("Все квесты завершены", "success");
        }
      }
    },

    reset: () => app.resetProgress(),

    getStats: () => {
      if (app.editor && app.editor.gameManager) {
        return app.editor.gameManager.getStatistics();
      }
      return null;
    },

    simulate: {
      typing: (wordsPerMinute = 60, duration = 60) => {
        if (!app.editor) return;

        const wordsToAdd = Math.floor((wordsPerMinute * duration) / 60);
        const interval = (duration * 1000) / wordsToAdd;

        let wordsAdded = 0;
        const timer = setInterval(() => {
          if (wordsAdded >= wordsToAdd) {
            clearInterval(timer);
            if (app.uiManager) {
              app.uiManager.showNotification(
                `Симуляция завершена: добавлено ${wordsToAdd} слов`,
                "success"
              );
            }
            return;
          }

          app.editor.gameManager.addWords(1);
          wordsAdded++;
        }, interval);

        if (app.uiManager) {
          app.uiManager.showNotification(
            `Симуляция набора текста: ${wordsPerMinute} слов/мин, ${duration} сек`,
            "info"
          );
        }
      },

      session: (targetWords = 500) => {
        if (!app.editor) return;

        if (app.uiManager) {
          app.uiManager.showNotification(
            `Симуляция сессии письма: цель ${targetWords} слов`,
            "info"
          );
        }

        const wordsPerStep = 10;
        const steps = Math.ceil(targetWords / wordsPerStep);
        const interval = 500;

        let step = 0;
        const timer = setInterval(() => {
          if (step >= steps) {
            clearInterval(timer);
            if (app.uiManager) {
              app.uiManager.showNotification(
                `Сессия завершена: написано ${targetWords} слов`,
                "success"
              );
            }
            return;
          }

          const wordsThisStep = Math.min(
            wordsPerStep,
            targetWords - step * wordsPerStep
          );
          app.editor.gameManager.addWords(wordsThisStep);
          step++;
        }, interval);
      },
    },
  },

  ui: {
    theme: (themeName) => {
      if (app.uiManager) {
        app.uiManager.setTheme(themeName);
      }
    },

    focusMode: (enabled) => {
      if (app.uiManager) {
        app.uiManager.toggleFocusMode(enabled);
      }
    },

    compact: (enabled) => {
      if (app.uiManager) {
        app.uiManager.toggleCompactMode(enabled);
      }
    },

    notify: (message, type, duration) => {
      if (app.uiManager) {
        app.uiManager.showNotification(message, type, duration);
      }
    },
  },
};

// Добавляем дополнительные стили
const additionalStyles = document.createElement("style");
additionalStyles.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes confetti {
    0% {
      transform: translateY(-100vh) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }
  
  @keyframes xpGain {
    0% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    50% {
      transform: translateY(-20px) scale(1.2);
      opacity: 0.8;
    }
    100% {
      transform: translateY(-40px) scale(0.8);
      opacity: 0;
    }
  }
  
  @keyframes levelUpEffect {
    0% {
      transform: scale(1) rotate(0deg);
    }
    25% {
      transform: scale(1.3) rotate(5deg);
    }
    50% {
      transform: scale(1.1) rotate(-5deg);
    }
    75% {
      transform: scale(1.2) rotate(2deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }
  
  @keyframes completedPulse {
    0% {
      transform: scale(1);
      background-color: white;
    }
    50% {
      transform: scale(1.02);
      background-color: #f0fdf4;
    }
    100% {
      transform: scale(1);
      background-color: white;
    }
  }
  
  /* Стили для режимов UI */
  .focus-mode .left-panel,
  .focus-mode .toolbar,
  .focus-mode .status-bar {
    display: none !important;
  }
  
  .focus-mode .main-content {
    grid-column: 1 / -1;
  }
  
  .compact .avatar {
    width: 60px;
    height: 60px;
    font-size: 24px;
  }
  
  .compact .level-badge {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
  
  .compact .stat-item {
    padding: 10px;
  }
  
  .compact .quest-card {
    padding: 10px;
  }
  
  /* Темы */
  .theme-dark {
    --primary: #8b5cf6;
    --background: #1f2937;
    --text: #f3f4f6;
    --border: #374151;
  }
  
  .theme-dark body {
    background-color: var(--background);
    color: var(--text);
  }
  
  .theme-cyberpunk {
    --primary: #00ff9f;
    --secondary: #ff006e;
    --background: #0a0a0a;
    --text: #00ff9f;
    --border: #333;
  }
  
  .theme-cyberpunk body {
    background: linear-gradient(45deg, #0a0a0a, #1a0a1a);
    color: var(--text);
    text-shadow: 0 0 5px currentColor;
  }
  
  .theme-nature {
    --primary: #22c55e;
    --secondary: #16a34a;
    --background: #f0fdf4;
    --text: #166534;
    --border: #bbf7d0;
  }
  
  /* Базовые стили приложения */
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.3s ease;
  }
  
  .app-container {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 250px 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 0;
  }
  
  .left-panel {
    grid-row: 1 / -1;
    background: var(--background, #f8fafc);
    border-right: 1px solid var(--border, #e2e8f0);
    padding: 20px;
  }
  
  .main-content {
    grid-column: 2;
    padding: 20px;
    background: white;
  }
  
  .toolbar {
    grid-column: 2;
    padding: 10px 20px;
    background: var(--background, #f8fafc);
    border-bottom: 1px solid var(--border, #e2e8f0);
  }
  
  .status-bar {
    grid-column: 2;
    padding: 10px 20px;
    background: var(--background, #f8fafc);
    border-top: 1px solid var(--border, #e2e8f0);
    font-size: 12px;
    color: var(--text, #64748b);
  }
  
  /* Уведомления */
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    animation: slideInRight 0.3s ease-out;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .notification.success {
    background: #10b981;
  }
  
  .notification.error {
    background: #ef4444;
  }
  
  .notification.warning {
    background: #f59e0b;
  }
  
  .notification.info {
    background: #3b82f6;
  }
`;
document.head.appendChild(additionalStyles);

// Инициализация уведомлений браузера
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

// Вывод информации в консоль
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
• WriterQuest.debug.addXP(500) - добавить опыт
• WriterQuest.debug.setLevel(10) - установить уровень
• WriterQuest.debug.unlockAll() - разблокировать достижения
• WriterQuest.debug.completeQuests() - завершить квесты
• WriterQuest.debug.reset() - сбросить прогресс

Симуляция:
• WriterQuest.debug.simulate.typing(60, 60) - симуляция набора (60 слов/мин, 60 сек)
• WriterQuest.debug.simulate.session(500) - симуляция сессии (500 слов)

UI команды:
• WriterQuest.ui.theme('dark') - темная тема
• WriterQuest.ui.theme('cyberpunk') - киберпанк тема
• WriterQuest.ui.theme('nature') - природная тема
• WriterQuest.ui.focusMode(true) - режим концентрации
• WriterQuest.ui.compact(true) - компактный режим

Информация:
• WriterQuest.info() - информация о состоянии
• WriterQuest.ready() - готовность приложения
• WriterQuest.version() - версия приложения

Удачного написания! ✍️
`);
