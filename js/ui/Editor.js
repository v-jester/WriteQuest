class TextEditor extends EventEmitter {
  constructor() {
    super();
    this.element = null;
    this.gameManager = null;
    this.commandManager = null;
    this.selectionManager = null;
    this.lastWordCount = 0;
    this.isReady = false;
    this.content = "";
    this.autoSaveInterval = 30000;
    this.lastAutoSave = Date.now();

    this.init();
  }

  init() {
    this.element = document.getElementById("editor");
    if (!this.element) {
      throw new Error("Editor element not found");
    }

    this.gameManager = new GameManager();
    this.commandManager = new CommandManager();
    this.selectionManager = new SelectionManager(this.element);

    this.setupEventListeners();
    this.setupAutoSave();
    this.updateWordCount();

    this.gameManager.updateUI();

    this.isReady = true;
    this.emit("ready");

    console.log("✅ TextEditor инициализирован");
  }

  setupEventListeners() {
    let typingTimer;
    const doneTypingInterval = 1000;

    this.element.addEventListener("input", (e) => {
      clearTimeout(typingTimer);
      this.content = this.element.textContent || "";

      const command = new TextChangeCommand(this, this.content);
      this.commandManager.execute(command);

      typingTimer = setTimeout(() => {
        this.updateWordCount();
      }, doneTypingInterval);
    });

    this.element.addEventListener("keydown", (e) => {
      this.handleKeydown(e);
    });

    this.element.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      this.insertText(text);
    });

    this.element.addEventListener("focus", () => {
      this.emit("focus");
    });

    this.element.addEventListener("blur", () => {
      this.emit("blur");
    });
  }

  handleKeydown(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "z":
          e.preventDefault();
          this.undo();
          break;
        case "y":
          e.preventDefault();
          this.redo();
          break;
        case "b":
          e.preventDefault();
          this.toggleBold();
          break;
        case "i":
          e.preventDefault();
          this.toggleItalic();
          break;
        case "u":
          e.preventDefault();
          this.toggleUnderline();
          break;
        case "a":
          e.preventDefault();
          this.selectAll();
          break;
      }
    }
  }

  setupAutoSave() {
    setInterval(() => {
      if (
        this.hasUnsavedChanges() &&
        Date.now() - this.lastAutoSave > this.autoSaveInterval
      ) {
        this.autoSave();
        this.lastAutoSave = Date.now();
      }
    }, 5000);
  }

  updateWordCount() {
    const text = this.element.textContent || "";
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const currentWordCount = words.length;

    if (currentWordCount > this.lastWordCount) {
      const newWords = currentWordCount - this.lastWordCount;
      this.gameManager.addWords(newWords);

      this.checkSpeedAchievements(newWords);
    }

    this.lastWordCount = currentWordCount;
    this.updateStatusBar(text, words);

    this.emit("wordCountChanged", {
      words: currentWordCount,
      characters: text.length,
      lines: text.split("\n").length,
    });
  }

  updateStatusBar(text, words) {
    const wordCountEl = document.getElementById("wordCount");
    const charCountEl = document.getElementById("charCount");
    const readTimeEl = document.getElementById("readTime");
    const saveStatusEl = document.getElementById("saveStatus");

    if (wordCountEl) wordCountEl.textContent = `Слов: ${words.length}`;
    if (charCountEl) charCountEl.textContent = `Символов: ${text.length}`;

    const readTime = Math.max(1, Math.ceil(words.length / 200));
    if (readTimeEl) readTimeEl.textContent = `Время чтения: ~${readTime} мин`;

    if (saveStatusEl) {
      saveStatusEl.textContent = this.hasUnsavedChanges()
        ? "Не сохранено"
        : "Сохранено";
    }
  }

  checkSpeedAchievements(wordsAdded) {
    const now = Date.now();
    if (!this.speedTracker) {
      this.speedTracker = { startTime: now, wordCount: 0 };
    }

    this.speedTracker.wordCount += wordsAdded;
    const timeElapsed = (now - this.speedTracker.startTime) / 1000 / 60;

    if (this.speedTracker.wordCount >= 100 && timeElapsed <= 5) {
      this.gameManager.unlockAchievement("speed_writer");
      this.speedTracker = null;
    } else if (timeElapsed > 5) {
      this.speedTracker = { startTime: now, wordCount: wordsAdded };
    }
  }

  toggleBold() {
    document.execCommand("bold", false, null);
    this.trackFormatUsage();
    this.emit("formatApplied", "bold");
  }

  toggleItalic() {
    document.execCommand("italic", false, null);
    this.trackFormatUsage();
    this.emit("formatApplied", "italic");
  }

  toggleUnderline() {
    document.execCommand("underline", false, null);
    this.trackFormatUsage();
    this.emit("formatApplied", "underline");
  }

  trackFormatUsage() {
    if (!this.formatsUsed) {
      this.formatsUsed = new Set();
    }

    if (document.queryCommandState("bold")) this.formatsUsed.add("bold");
    if (document.queryCommandState("italic")) this.formatsUsed.add("italic");
    if (document.queryCommandState("underline"))
      this.formatsUsed.add("underline");

    this.gameManager.trackFormatUsage(this.formatsUsed);
  }

  undo() {
    if (this.commandManager.canUndo()) {
      this.commandManager.undo();
      this.updateWordCount();
      this.emit("undo");
    }
  }

  redo() {
    if (this.commandManager.canRedo()) {
      this.commandManager.redo();
      this.updateWordCount();
      this.emit("redo");
    }
  }

  selectAll() {
    this.selectionManager.selectAll();
  }

  insertText(text) {
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection.getRangeAt && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    this.updateWordCount();
    this.emit("textInserted", text);
  }

  getContent() {
    return this.element.textContent || "";
  }

  getHtmlContent() {
    return this.element.innerHTML || "";
  }

  setContent(content) {
    this.element.textContent = content;
    this.content = content;
    this.updateWordCount();
    this.emit("contentChanged", content);
  }

  setHtmlContent(html) {
    this.element.innerHTML = html;
    this.content = this.element.textContent || "";
    this.updateWordCount();
    this.emit("contentChanged", this.content);
  }

  clear() {
    this.element.textContent = "";
    this.content = "";
    this.lastWordCount = 0;
    this.formatsUsed = new Set();
    this.speedTracker = null;
    this.updateWordCount();
    this.emit("cleared");
  }

  focus() {
    this.element.focus();
  }

  blur() {
    this.element.blur();
  }

  hasUnsavedChanges() {
    return this.commandManager.hasUnsavedChanges();
  }

  markAsSaved() {
    this.commandManager.markAsSaved();
    const saveStatusEl = document.getElementById("saveStatus");
    if (saveStatusEl) saveStatusEl.textContent = "Сохранено";
    this.emit("saved");
  }

  autoSave() {
    if (this.gameManager && this.gameManager.settings.autoSave) {
      this.gameManager.saveProgress();
      this.markAsSaved();
      this.emit("autoSaved");
    }
  }

  getWordCount() {
    return this.lastWordCount;
  }

  getCharacterCount() {
    return this.content.length;
  }

  getSelectedText() {
    return this.selectionManager.getSelectedText();
  }

  getSelectionInfo() {
    return this.selectionManager.getSelectionInfo();
  }

  async improveText() {
    const selectedText = this.getSelectedText();
    if (!selectedText) {
      window.showNotification("Выделите текст для улучшения", "warning");
      return;
    }

    window.showNotification("AI улучшение временно недоступно", "info");
    this.gameManager.trackAIUsage();
  }

  async completeText() {
    const cursorPosition = this.selectionManager.getCursorPosition();
    const textBefore = this.content.substring(0, cursorPosition);

    window.showNotification("AI автодополнение временно недоступно", "info");
    this.gameManager.trackAIUsage();
  }

  async analyzeSentiment() {
    const text = this.getContent();
    if (!text.trim()) {
      window.showNotification("Нет текста для анализа", "warning");
      return;
    }

    window.showNotification("Анализ настроения временно недоступен", "info");
    this.gameManager.trackAIUsage();
  }

  getStatistics() {
    return {
      wordCount: this.getWordCount(),
      characterCount: this.getCharacterCount(),
      formatsUsed: Array.from(this.formatsUsed || []),
      gameStats: this.gameManager.getStatistics(),
      userInfo: this.gameManager.getUserInfo(),
    };
  }
}

class TextChangeCommand extends Command {
  constructor(editor, newContent, oldContent = null) {
    super();
    this.editor = editor;
    this.newContent = newContent;
    this.oldContent = oldContent || editor.content;
  }

  execute() {
    this.editor.setContent(this.newContent);
  }

  undo() {
    this.editor.setContent(this.oldContent);
  }

  getDescription() {
    return "Text Change";
  }
}
