class UIManager extends EventEmitter {
  constructor(editor) {
    super();
    this.editor = editor;
    this.toolbar = null;
    this.statusBar = null;
    this.isInitialized = false;
    this.theme = "default";
    this.notifications = [];

    this.init();
  }

  init() {
    try {
      this.toolbar = new Toolbar(this.editor);
      this.statusBar = new StatusBar(this.editor);

      this.setupGlobalEvents();
      this.loadSettings();

      this.isInitialized = true;
      console.log("✅ UIManager инициализирован");

      this.emit("initialized");
    } catch (error) {
      console.error("❌ Ошибка инициализации UIManager:", error);
      throw error;
    }
  }

  setupGlobalEvents() {
    document.addEventListener("keydown", (e) => {
      this.handleGlobalKeydown(e);
    });

    if (this.editor.gameManager) {
      this.editor.gameManager.on("wordsAdded", (data) => {
        this.updateStats();
        this.showXPGain(data.xpGain);
      });

      this.editor.gameManager.on("levelUp", (data) => {
        this.showLevelUpNotification(data);
      });

      this.editor.gameManager.on("achievementUnlocked", (data) => {
        this.showAchievementModal(data.achievement);
      });

      this.editor.gameManager.on("questCompleted", (data) => {
        this.showQuestCompletedNotification(data.quest);
      });
    }

    this.editor.on("ready", () => {
      this.updateStats();
    });

    this.editor.on("wordCountChanged", () => {
      this.updateStats();
    });

    this.setupModalEvents();
  }

  setupModalEvents() {
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        this.closeModal(e.target.id);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeAllModals();
      }
    });
  }

  handleGlobalKeydown(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case ",":
          e.preventDefault();
          this.showSettingsModal();
          break;
        case "/":
          e.preventDefault();
          this.showHelpModal();
          break;
      }
    }

    switch (e.key) {
      case "F1":
        e.preventDefault();
        this.showHelpModal();
        break;
      case "F11":
        e.preventDefault();
        this.toggleFullscreen();
        break;
    }
  }

  updateStats() {
    if (!this.editor.gameManager) return;

    const gameManager = this.editor.gameManager;

    this.updateElement("levelBadge", gameManager.level);
    this.updateElement("userTitle", gameManager.getUserTitle());
    this.updateElement("todayWords", gameManager.dailyWords);
    this.updateElement("totalWords", gameManager.totalWords);
    this.updateElement("currentStreak", gameManager.streak);
    this.updateElement(
      "xpProgress",
      `${gameManager.xp} / ${gameManager.xpToNextLevel} XP`
    );

    const dailyProgress = Math.min(
      (gameManager.dailyWords / gameManager.settings.dailyWordTarget) * 100,
      100
    );
    this.updateProgressBar("dailyProgress", dailyProgress);

    const xpProgress = (gameManager.xp / gameManager.xpToNextLevel) * 100;
    this.updateProgressBar("xpProgressBar", xpProgress);

    this.updateQuests();
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateProgressBar(id, percentage) {
    const element = document.getElementById(id);
    if (element) {
      element.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }
  }

  updateQuests() {
    const questList = document.getElementById("questList");
    if (!questList || !this.editor.gameManager) return;

    questList.innerHTML = "";

    this.editor.gameManager.quests.forEach((quest) => {
      const questCard = this.createQuestCard(quest);
      questList.appendChild(questCard);
    });
  }

  createQuestCard(quest) {
    const questCard = document.createElement("div");
    questCard.className = `quest-card ${quest.completed ? "completed" : ""}`;

    const progressPercent = Math.min(
      (quest.progress / quest.target) * 100,
      100
    );

    questCard.innerHTML = `
      <div class="quest-title">${quest.icon || "📝"} ${quest.title}</div>
      <div class="quest-description">${quest.description}</div>
      <div class="quest-reward">⭐ +${quest.xp} XP</div>
      <div class="quest-progress">
        <div class="quest-progress-bar">
          <div class="quest-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    `;

    if (quest.completed) {
      questCard.style.animation = "completedPulse 0.5s ease-out";
    }

    return questCard;
  }

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
    this.notifications.push(notification);

    notification.addEventListener("click", () => {
      this.removeNotification(notification);
    });

    setTimeout(() => {
      this.removeNotification(notification);
    }, duration);

    this.emit("notificationShown", { message, type, duration });
  }

  removeNotification(notification) {
    if (notification && notification.parentNode) {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);

      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }
  }

  getNotificationColor(type) {
    const colors = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#6366f1",
    };
    return colors[type] || colors.info;
  }

  showXPGain(amount) {
    if (amount <= 0) return;

    const xpElement = document.getElementById("xpProgress");
    if (xpElement) {
      const gainElement = document.createElement("span");
      gainElement.textContent = `+${amount} XP`;
      gainElement.style.cssText = `
        position: absolute;
        color: var(--success);
        font-weight: bold;
        animation: xpGain 1s ease-out forwards;
        pointer-events: none;
        z-index: 1000;
      `;

      xpElement.style.position = "relative";
      xpElement.appendChild(gainElement);

      setTimeout(() => {
        if (gainElement.parentNode) {
          gainElement.parentNode.removeChild(gainElement);
        }
      }, 1000);
    }
  }

  showLevelUpNotification(data) {
    this.showNotification(
      `🎉 Поздравляем! Достигнут ${data.newLevel} уровень!`,
      "success",
      5000
    );

    this.createConfetti();
    this.animateLevelBadge();
  }

  showQuestCompletedNotification(quest) {
    this.showNotification(
      `✅ Квест завершен: ${quest.title}! +${quest.xp} XP`,
      "success",
      4000
    );
  }

  animateLevelBadge() {
    const levelBadge = document.getElementById("levelBadge");
    if (levelBadge) {
      levelBadge.style.animation = "none";
      setTimeout(() => {
        levelBadge.style.animation = "levelUpEffect 2s ease-out";
      }, 10);
    }
  }

  createConfetti() {
    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.style.cssText = `
        position: fixed;
        width: 8px;
        height: 8px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -10px;
        border-radius: 50%;
        animation: confetti 3s linear forwards;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(confetti);

      setTimeout(() => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      }, 3000);
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      this.emit("modalShown", modalId);
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      this.emit("modalClosed", modalId);
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll(".modal-overlay.active");
    modals.forEach((modal) => {
      modal.classList.remove("active");
    });
  }

  showHelpModal() {
    this.showModal("helpModal");
  }

  showSettingsModal() {
    this.loadSettingsToModal();
    this.showModal("settingsModal");
  }

  showAchievementModal(achievement) {
    const modal = document.getElementById("achievementModal");
    const description = document.getElementById("achievementDescription");
    const xpReward = document.getElementById("achievementXP");

    if (modal && description && xpReward) {
      description.textContent = `${achievement.icon} ${achievement.name} - ${achievement.description}`;
      xpReward.textContent = achievement.xp || 100;

      modal.classList.add("active");
      this.createConfetti();
    }
  }

  loadSettingsToModal() {
    if (!this.editor.gameManager) return;

    const settings = this.editor.gameManager.settings;

    const elements = {
      autoSaveToggle: document.getElementById("autoSaveToggle"),
      notificationsToggle: document.getElementById("notificationsToggle"),
      dailyWordTarget: document.getElementById("dailyWordTarget"),
      difficultySelect: document.getElementById("difficultySelect"),
    };

    if (elements.autoSaveToggle)
      elements.autoSaveToggle.checked = settings.autoSave;
    if (elements.notificationsToggle)
      elements.notificationsToggle.checked = settings.notifications;
    if (elements.dailyWordTarget)
      elements.dailyWordTarget.value = settings.dailyWordTarget;
    if (elements.difficultySelect)
      elements.difficultySelect.value = settings.difficulty;
  }

  saveSettings() {
    const settings = {
      autoSave: document.getElementById("autoSaveToggle")?.checked ?? true,
      notifications:
        document.getElementById("notificationsToggle")?.checked ?? true,
      dailyWordTarget:
        parseInt(document.getElementById("dailyWordTarget")?.value) || 500,
      difficulty:
        document.getElementById("difficultySelect")?.value || "normal",
    };

    if (this.editor.gameManager) {
      this.editor.gameManager.updateSettings(settings);

      const dailyQuest = this.editor.gameManager.quests.find(
        (q) => q.id === "daily_words"
      );
      if (dailyQuest) {
        dailyQuest.target = settings.dailyWordTarget;
        dailyQuest.description = `Напишите ${settings.dailyWordTarget} слов`;
      }

      this.updateStats();
    }

    this.closeModal("settingsModal");
    this.showNotification("Настройки сохранены", "success");
  }

  setTheme(themeName) {
    this.theme = themeName;
    document.body.className = `theme-${themeName}`;

    if (this.toolbar) {
      this.toolbar.applyTheme(themeName);
    }

    if (this.statusBar) {
      this.statusBar.applyTheme(themeName);
    }

    localStorage.setItem("writerquest-theme", themeName);
    this.emit("themeChanged", themeName);
  }

  loadSettings() {
    const savedTheme = localStorage.getItem("writerquest-theme");
    if (savedTheme) {
      this.setTheme(savedTheme);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          this.showNotification("Полноэкранный режим включен", "info");
        })
        .catch((err) => {
          this.showNotification(
            "Не удалось включить полноэкранный режим",
            "error"
          );
        });
    } else {
      document.exitFullscreen().then(() => {
        this.showNotification("Полноэкранный режим выключен", "info");
      });
    }
  }

  toggleFocusMode(enabled) {
    const leftPanel = document.querySelector(".left-panel");
    const toolbar = document.getElementById("toolbar");
    const statusBar = document.getElementById("statusBar");

    if (enabled) {
      if (leftPanel) leftPanel.style.display = "none";
      if (toolbar) toolbar.style.display = "none";
      if (statusBar) statusBar.style.display = "none";

      document.body.classList.add("focus-mode");
      this.showNotification("Режим концентрации включен", "info");
    } else {
      if (leftPanel) leftPanel.style.display = "block";
      if (toolbar) toolbar.style.display = "flex";
      if (statusBar) statusBar.style.display = "flex";

      document.body.classList.remove("focus-mode");
      this.showNotification("Режим концентрации выключен", "info");
    }

    this.emit("focusModeChanged", enabled);
  }

  toggleCompactMode(enabled) {
    if (this.toolbar) {
      this.toolbar.toggleCompactMode(enabled);
    }

    const leftPanel = document.querySelector(".left-panel");
    if (leftPanel) {
      if (enabled) {
        leftPanel.classList.add("compact");
      } else {
        leftPanel.classList.remove("compact");
      }
    }

    this.emit("compactModeChanged", enabled);
  }

  showLoadingScreen(message = "Загрузка...") {
    const modal = document.getElementById("loadingModal");
    const messageEl = document.querySelector(".loading-message");

    if (modal) {
      if (messageEl) messageEl.textContent = message;
      modal.classList.add("active");
    }
  }

  hideLoadingScreen() {
    const modal = document.getElementById("loadingModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  showError(message, title = "Ошибка") {
    const modal = document.getElementById("errorModal");
    const titleEl = document.querySelector(".error-title");
    const messageEl = document.getElementById("errorMessage");

    if (modal) {
      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;
      modal.classList.add("active");
    }
  }

  showProgress(percentage, message = "") {
    if (this.statusBar) {
      this.statusBar.showProgress(percentage, message);
    }
  }

  hideProgress() {
    if (this.statusBar) {
      this.statusBar.hideProgress();
    }
  }

  getUIStatistics() {
    return {
      theme: this.theme,
      notificationsShown: this.notifications.length,
      toolbar: this.toolbar ? this.toolbar.getAllButtons().length : 0,
      statusBar: this.statusBar ? this.statusBar.getStatistics() : {},
      modalsAvailable: document.querySelectorAll(".modal-overlay").length,
    };
  }

  destroy() {
    this.notifications.forEach((notification) => {
      this.removeNotification(notification);
    });

    if (this.toolbar) {
      this.toolbar.destroy();
    }

    if (this.statusBar) {
      this.statusBar.destroy();
    }

    this.closeAllModals();

    this.removeAllListeners();
    this.isInitialized = false;
  }
}

window.closeModal = function (modalId) {
  if (window.app && window.app.uiManager) {
    window.app.uiManager.closeModal(modalId);
  }
};

window.saveSettings = function () {
  if (window.app && window.app.uiManager) {
    window.app.uiManager.saveSettings();
  }
};

window.showNotification = function (message, type, duration) {
  if (window.app && window.app.uiManager) {
    window.app.uiManager.showNotification(message, type, duration);
  }
};
