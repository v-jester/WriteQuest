class GameManager extends EventEmitter {
  constructor() {
    super();

    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 1000;
    this.streak = 0;
    this.dailyWords = 0;
    this.totalWords = 0;
    this.sessionsPlayed = 0;
    this.lastSaveDate = new Date().toDateString();

    this.achievements = new Map();
    this.quests = [];
    this.statistics = {
      totalSessions: 0,
      totalTimeSpent: 0,
      averageWordsPerSession: 0,
      bestDailyScore: 0,
      longestStreak: 0,
    };

    this.settings = {
      dailyWordTarget: 500,
      autoSave: true,
      notifications: true,
      difficulty: "normal",
    };

    this.initializeAchievements();
    this.initializeQuests();
    this.loadProgress();

    this._startPeriodicChecks();
  }

  initializeAchievements() {
    const achievementsList = [
      {
        id: "first_word",
        name: "Первое слово",
        description: "Напишите первое слово",
        icon: "✏️",
        xp: 50,
        category: "writing",
        rarity: "common",
      },
      {
        id: "hundred_words",
        name: "Сотня",
        description: "Напишите 100 слов",
        icon: "💯",
        xp: 100,
        category: "writing",
        rarity: "common",
      },
      {
        id: "thousand_words",
        name: "Тысячник",
        description: "Напишите 1000 слов",
        icon: "📚",
        xp: 200,
        category: "writing",
        rarity: "uncommon",
      },
      {
        id: "five_thousand_words",
        name: "Продуктивный автор",
        description: "Напишите 5000 слов",
        icon: "📖",
        xp: 500,
        category: "writing",
        rarity: "rare",
      },
      {
        id: "first_streak",
        name: "Первая серия",
        description: "3 дня подряд",
        icon: "🔥",
        xp: 150,
        category: "consistency",
        rarity: "common",
      },
      {
        id: "week_streak",
        name: "Недельный марафон",
        description: "7 дней подряд",
        icon: "🏃",
        xp: 300,
        category: "consistency",
        rarity: "uncommon",
      },
      {
        id: "month_streak",
        name: "Месячный подвиг",
        description: "30 дней подряд",
        icon: "🏆",
        xp: 1000,
        category: "consistency",
        rarity: "epic",
      },
      {
        id: "speed_writer",
        name: "Скоростной писатель",
        description: "100 слов за 5 минут",
        icon: "⚡",
        xp: 250,
        category: "speed",
        rarity: "uncommon",
      },
      {
        id: "night_owl",
        name: "Ночная сова",
        description: "Пишите после полуночи",
        icon: "🦉",
        xp: 100,
        category: "time",
        rarity: "common",
      },
      {
        id: "early_bird",
        name: "Ранняя пташка",
        description: "Пишите до 6 утра",
        icon: "🐦",
        xp: 100,
        category: "time",
        rarity: "common",
      },
      {
        id: "perfectionist",
        name: "Перфекционист",
        description: "Используйте все инструменты форматирования",
        icon: "✨",
        xp: 150,
        category: "tools",
        rarity: "uncommon",
      },
      {
        id: "ai_enthusiast",
        name: "Энтузиаст AI",
        description: "Используйте AI помощника 50 раз",
        icon: "🤖",
        xp: 300,
        category: "ai",
        rarity: "rare",
      },
    ];

    achievementsList.forEach((achievement) => {
      this.achievements.set(achievement.id, {
        ...achievement,
        unlocked: false,
        unlockedAt: null,
        progress: 0,
        maxProgress: this._getAchievementMaxProgress(achievement.id),
      });
    });
  }

  initializeQuests() {
    this.quests = [
      {
        id: "daily_words",
        title: "Дневная норма",
        description: `Напишите ${this.settings.dailyWordTarget} слов`,
        target: this.settings.dailyWordTarget,
        progress: 0,
        xp: 100,
        type: "words",
        completed: false,
        daily: true,
        icon: "📝",
      },
      {
        id: "morning_writing",
        title: "Утренние страницы",
        description: "Напишите 250 слов до полудня",
        target: 250,
        progress: 0,
        xp: 150,
        type: "time_based",
        completed: false,
        daily: true,
        icon: "🌅",
      },
      {
        id: "format_master",
        title: "Мастер форматирования",
        description: "Используйте 3 разных стиля форматирования",
        target: 3,
        progress: 0,
        xp: 75,
        type: "format",
        completed: false,
        daily: true,
        icon: "🎨",
      },
      {
        id: "ai_explorer",
        title: "Исследователь AI",
        description: "Используйте AI помощника 3 раза",
        target: 3,
        progress: 0,
        xp: 125,
        type: "ai",
        completed: false,
        daily: true,
        icon: "🚀",
      },
      {
        id: "focused_session",
        title: "Сфокусированная сессия",
        description: "Пишите 30 минут без перерыва",
        target: 30,
        progress: 0,
        xp: 200,
        type: "time",
        completed: false,
        daily: true,
        icon: "🎯",
      },
    ];
  }

  /**
   * @param {number} count
   */
  addWords(count) {
    if (count <= 0) return;

    const previousTotal = this.totalWords;
    const previousDaily = this.dailyWords;

    this.dailyWords += count;
    this.totalWords += count;

    this._checkWordAchievements(previousTotal, this.totalWords);

    this.updateQuest("daily_words", this.dailyWords);

    const hour = new Date().getHours();
    if (hour < 12) {
      this.updateQuest("morning_writing", count);
    }

    const xpGain = Math.floor(count / 10);
    this.addXP(xpGain);

    this._updateStatistics("wordsAdded", count);

    this.saveProgress();

    this.emit("wordsAdded", {
      count,
      totalWords: this.totalWords,
      dailyWords: this.dailyWords,
      xpGain,
    });
  }

  /**
   * @param {number} amount
   */
  addXP(amount) {
    if (amount <= 0) return;

    const previousLevel = this.level;
    this.xp += amount;

    const levelsGained = this._checkLevelUp();

    this.emit("xpAdded", {
      amount,
      totalXP: this.xp,
      level: this.level,
      levelsGained,
      xpToNext: this.xpToNextLevel - this.xp,
    });

    if (levelsGained > 0) {
      this.emit("levelUp", {
        newLevel: this.level,
        previousLevel,
        levelsGained,
      });
      this.showLevelUpAnimation();
    }
  }

  /**
   * @param {string} questId
   * @param {number} progress
   */
  updateQuest(questId, progress) {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest || quest.completed) {
      return;
    }

    const previousProgress = quest.progress;

    if (quest.type === "words" && questId === "daily_words") {
      quest.progress = Math.min(progress, quest.target);
    } else {
      quest.progress = Math.min(quest.progress + progress, quest.target);
    }

    if (quest.progress >= quest.target && !quest.completed) {
      quest.completed = true;
      this.addXP(quest.xp);

      this.emit("questCompleted", {
        quest: { ...quest },
        xpReward: quest.xp,
      });

      this._showQuestCompletedAnimation(quest);
    } else if (quest.progress !== previousProgress) {
      this.emit("questUpdated", {
        quest: { ...quest },
        previousProgress,
      });
    }
  }

  /**
   * @param {string} achievementId
   */
  unlockAchievement(achievementId) {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) {
      return;
    }

    achievement.unlocked = true;
    achievement.unlockedAt = new Date();

    this.addXP(achievement.xp);

    this.emit("achievementUnlocked", {
      achievement: { ...achievement },
      xpReward: achievement.xp,
    });

    this.showAchievementModal(achievement);
    this.saveProgress();
  }

  updateStreak() {
    const today = new Date().toDateString();
    const lastSave = new Date(this.lastSaveDate);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate - lastSave) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      this.streak++;
      this.statistics.longestStreak = Math.max(
        this.statistics.longestStreak,
        this.streak
      );

      this._checkStreakAchievements();
    } else if (daysDiff > 1) {
      this.streak = 1;
    }

    this.lastSaveDate = today;
    this.emit("streakUpdated", {
      streak: this.streak,
      isNewRecord: this.streak === this.statistics.longestStreak,
    });
  }

  checkTimeBasedAchievements() {
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 6) {
      this.unlockAchievement("early_bird");
    } else if (hour >= 0 && hour < 4) {
      this.unlockAchievement("night_owl");
    }
  }

  /**
   * @param {Set} formatsUsed
   */
  trackFormatUsage(formatsUsed) {
    this.updateQuest("format_master", formatsUsed.size);

    if (formatsUsed.size >= 3) {
      this.unlockAchievement("perfectionist");
    }
  }
  trackAIUsage() {
    this.updateQuest("ai_explorer", 1);
    const achievement = this.achievements.get("ai_enthusiast");
    if (achievement && !achievement.unlocked) {
      achievement.progress++;
      if (achievement.progress >= 50) {
        this.unlockAchievement("ai_enthusiast");
      }
    }
  }

  resetDailyProgress() {
    const today = new Date().toDateString();
    if (this.lastSaveDate !== today) {
      this.statistics.bestDailyScore = Math.max(
        this.statistics.bestDailyScore,
        this.dailyWords
      );

      this.dailyWords = 0;

      this.quests.forEach((quest) => {
        if (quest.daily) {
          quest.progress = 0;
          quest.completed = false;
        }
      });

      this.updateStreak();

      this.emit("dailyReset", {
        previousDayWords: this.statistics.bestDailyScore,
        newDay: today,
      });
    }
  }

  saveProgress() {
    if (!this.settings.autoSave) return;

    const data = {
      version: "1.0",
      level: this.level,
      xp: this.xp,
      xpToNextLevel: this.xpToNextLevel,
      streak: this.streak,
      dailyWords: this.dailyWords,
      totalWords: this.totalWords,
      sessionsPlayed: this.sessionsPlayed,
      lastSaveDate: this.lastSaveDate,
      achievements: Array.from(this.achievements.entries()),
      quests: this.quests,
      statistics: this.statistics,
      settings: this.settings,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("writerQuestProgress", JSON.stringify(data));
      this.emit("progressSaved", data);
    } catch (error) {
      console.warn("Could not save progress:", error);
      this.emit("saveError", error);
    }
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem("writerQuestProgress");
      if (!saved) {
        this.emit("progressLoaded", { isFirstTime: true });
        return;
      }

      const data = JSON.parse(saved);

      if (data.version !== "1.0") {
        console.warn("Save data version mismatch, using defaults");
        return;
      }

      this.level = data.level || 1;
      this.xp = data.xp || 0;
      this.xpToNextLevel = data.xpToNextLevel || 1000;
      this.streak = data.streak || 0;
      this.totalWords = data.totalWords || 0;
      this.sessionsPlayed = data.sessionsPlayed || 0;
      this.lastSaveDate = data.lastSaveDate || new Date().toDateString();

      if (data.achievements) {
        const savedAchievements = new Map(data.achievements);
        for (const [id, achievement] of this.achievements) {
          const saved = savedAchievements.get(id);
          if (saved) {
            this.achievements.set(id, { ...achievement, ...saved });
          }
        }
      }

      if (data.quests) {
        this.quests = data.quests.map((savedQuest) => {
          const defaultQuest = this.quests.find((q) => q.id === savedQuest.id);
          return defaultQuest ? { ...defaultQuest, ...savedQuest } : savedQuest;
        });
      }

      this.statistics = { ...this.statistics, ...(data.statistics || {}) };
      this.settings = { ...this.settings, ...(data.settings || {}) };

      this.resetDailyProgress();

      this.emit("progressLoaded", {
        isFirstTime: false,
        loadedData: data,
      });
    } catch (error) {
      console.warn("Could not load progress:", error);
      this.emit("loadError", error);
    }
  }

  /**
   * @returns {Object}
   */
  getUserInfo() {
    return {
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNextLevel - this.xp,
      xpProgress: (this.xp / this.xpToNextLevel) * 100,
      title: this.getUserTitle(),
      streak: this.streak,
      dailyWords: this.dailyWords,
      totalWords: this.totalWords,
      sessionsPlayed: this.sessionsPlayed,
      achievementsUnlocked: Array.from(this.achievements.values()).filter(
        (a) => a.unlocked
      ).length,
      totalAchievements: this.achievements.size,
      questsCompleted: this.quests.filter((q) => q.completed).length,
      totalQuests: this.quests.length,
    };
  }

  /**
   * @returns {string}
   */
  getUserTitle() {
    const titles = [
      { level: 1, title: "Начинающий автор" },
      { level: 5, title: "Молодой писатель" },
      { level: 10, title: "Талантливый автор" },
      { level: 20, title: "Опытный писатель" },
      { level: 35, title: "Мастер пера" },
      { level: 50, title: "Литературный гений" },
      { level: 75, title: "Легенда литературы" },
      { level: 100, title: "Бессмертный классик" },
    ];

    for (let i = titles.length - 1; i >= 0; i--) {
      if (this.level >= titles[i].level) {
        return titles[i].title;
      }
    }

    return titles[0].title;
  }

  /**
   * @returns {Object}
   */
  getStatistics() {
    const totalAchievements = this.achievements.size;
    const unlockedAchievements = Array.from(this.achievements.values()).filter(
      (a) => a.unlocked
    ).length;

    return {
      ...this.statistics,
      level: this.level,
      totalWords: this.totalWords,
      dailyWords: this.dailyWords,
      streak: this.streak,
      achievementProgress: Math.round(
        (unlockedAchievements / totalAchievements) * 100
      ),
      averageWordsPerDay:
        this.sessionsPlayed > 0
          ? Math.round(this.totalWords / this.sessionsPlayed)
          : 0,
      xpPerWord:
        this.totalWords > 0
          ? Math.round((this.xp / this.totalWords) * 100) / 100
          : 0,
    };
  }

  /**
   * @param {Object} newSettings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };

    if (newSettings.dailyWordTarget) {
      const dailyQuest = this.quests.find((q) => q.id === "daily_words");
      if (dailyQuest) {
        dailyQuest.target = newSettings.dailyWordTarget;
        dailyQuest.description = `Напишите ${newSettings.dailyWordTarget} слов`;
      }
    }

    this.saveProgress();
    this.emit("settingsUpdated", this.settings);
  }

  /**
   *
   */
  resetProgress() {
    const finalStats = this.getStatistics();

    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 1000;
    this.streak = 0;
    this.dailyWords = 0;
    this.totalWords = 0;
    this.sessionsPlayed = 0;
    this.lastSaveDate = new Date().toDateString();

    this.initializeAchievements();
    this.initializeQuests();

    this.statistics = {
      totalSessions: 0,
      totalTimeSpent: 0,
      averageWordsPerSession: 0,
      bestDailyScore: 0,
      longestStreak: 0,
    };

    try {
      localStorage.removeItem("writerQuestProgress");
    } catch (error) {
      console.warn("Could not clear save data:", error);
    }

    this.emit("progressReset", { finalStats });
  }

  /**
   *
   * @returns {number}
   * @private
   */
  _checkLevelUp() {
    let levelsGained = 0;

    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level++;
      levelsGained++;

      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
    }

    return levelsGained;
  }

  /**
   *
   * @param {number} previousTotal
   * @param {number} currentTotal
   * @private
   */
  _checkWordAchievements(previousTotal, currentTotal) {
    const milestones = [
      { words: 1, achievement: "first_word" },
      { words: 100, achievement: "hundred_words" },
      { words: 1000, achievement: "thousand_words" },
      { words: 5000, achievement: "five_thousand_words" },
    ];

    milestones.forEach(({ words, achievement }) => {
      if (previousTotal < words && currentTotal >= words) {
        this.unlockAchievement(achievement);
      }
    });
  }

  /**
   *
   * @private
   */
  _checkStreakAchievements() {
    if (this.streak === 3) {
      this.unlockAchievement("first_streak");
    } else if (this.streak === 7) {
      this.unlockAchievement("week_streak");
    } else if (this.streak === 30) {
      this.unlockAchievement("month_streak");
    }
  }

  /**
   *
   * @param {string} achievementId
   * @returns {number}
   * @private
   */
  _getAchievementMaxProgress(achievementId) {
    const progressMap = {
      ai_enthusiast: 50,
      perfectionist: 3,
      speed_writer: 1,
    };

    return progressMap[achievementId] || 1;
  }

  /**
   *
   * @param {string} action
   * @param {any} value
   * @private
   */
  _updateStatistics(action, value) {
    switch (action) {
      case "wordsAdded":
        this.statistics.averageWordsPerSession = Math.round(
          this.totalWords / Math.max(1, this.sessionsPlayed)
        );
        break;
      case "sessionStarted":
        this.statistics.totalSessions++;
        this.sessionsPlayed++;
        break;
      case "timeSpent":
        this.statistics.totalTimeSpent += value;
        break;
    }
  }

  /**
   *
   * @private
   */
  _startPeriodicChecks() {
    setInterval(() => {
      this.checkTimeBasedAchievements();
    }, 60000);

    setInterval(() => {
      if (this.settings.autoSave) {
        this.saveProgress();
      }
    }, 30000);
  }

  /**
   *
   */
  showLevelUpAnimation() {
    const levelBadge = document.getElementById("levelBadge");
    if (levelBadge) {
      levelBadge.style.animation = "levelUp 0.5s ease-out";
      setTimeout(() => {
        levelBadge.style.animation = "";
      }, 500);
    }
    this.createConfetti();
  }

  /**
   *
   * @param {Object} achievement
   */
  showAchievementModal(achievement) {
    const modal = document.getElementById("achievementModal");
    const description = document.getElementById("achievementDescription");
    const xpReward = document.getElementById("achievementXP");

    if (modal && description && xpReward) {
      description.textContent = `${achievement.icon} ${achievement.name} - ${achievement.description}`;
      xpReward.textContent = achievement.xp;

      modal.classList.add("active");
      this.createConfetti();
    }
  }

  /**
   *
   * @param {Object} quest
   * @private
   */
  _showQuestCompletedAnimation(quest) {
    const questElements = document.querySelectorAll(".quest-card");
    questElements.forEach((element) => {
      if (element.textContent.includes(quest.title)) {
        element.classList.add("completed");
        element.style.animation = "completedPulse 0.5s ease-out";
      }
    });
  }

  createConfetti() {
    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 3 + "s";
      document.body.appendChild(confetti);

      setTimeout(() => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      }, 3000);
    }
  }
}
