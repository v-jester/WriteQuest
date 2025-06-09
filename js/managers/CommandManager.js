class CommandManager extends EventEmitter {
  constructor(maxHistory = 100) {
    super();
    this.history = [];
    this.currentIndex = -1;
    this.maxHistory = maxHistory;
    this.savedIndex = -1;
  }

  /**
   *
   * @param {Command} command
   */
  execute(command) {
    if (!(command instanceof Command)) {
      throw new Error("Command must be an instance of Command class");
    }

    try {
      this.history = this.history.slice(0, this.currentIndex + 1);

      command.execute();

      this.history.push(command);
      this.currentIndex++;

      this._trimHistory();

      this.emit("commandExecuted", command);
      this.emit("historyChanged", this.getHistoryInfo());
    } catch (error) {
      console.error("Error executing command:", error);
      this.emit("commandError", error, command);
      throw error;
    }
  }

  /**
   *
   * @returns {boolean}
   */
  undo() {
    if (!this.canUndo()) {
      return false;
    }

    try {
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;

      this.emit("commandUndone", command);
      this.emit("historyChanged", this.getHistoryInfo());

      return true;
    } catch (error) {
      console.error("Error undoing command:", error);
      this.emit("commandError", error, this.history[this.currentIndex]);
      return false;
    }
  }

  /**
   *
   * @returns {boolean}
   */
  redo() {
    if (!this.canRedo()) {
      return false;
    }

    try {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.execute();

      this.emit("commandRedone", command);
      this.emit("historyChanged", this.getHistoryInfo());

      return true;
    } catch (error) {
      console.error("Error redoing command:", error);
      this.currentIndex--;
      this.emit("commandError", error, this.history[this.currentIndex + 1]);
      return false;
    }
  }

  /**
   *
   * @returns {boolean}
   */
  canUndo() {
    return (
      this.currentIndex >= 0 &&
      this.history[this.currentIndex] &&
      this.history[this.currentIndex].canUndo()
    );
  }

  /**
   *
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   *
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.savedIndex = -1;
    this.emit("historyCleared");
    this.emit("historyChanged", this.getHistoryInfo());
  }

  /**
   *
   */
  markAsSaved() {
    this.savedIndex = this.currentIndex;
    this.emit("stateSaved");
  }

  /**
   *
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.currentIndex !== this.savedIndex;
  }

  /**
   *
   * @returns {Object}
   */
  getHistoryInfo() {
    return {
      totalCommands: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      currentCommand: this.history[this.currentIndex]?.getDescription() || null,
      nextCommand:
        this.history[this.currentIndex + 1]?.getDescription() || null,
      previousCommand:
        this.history[this.currentIndex - 1]?.getDescription() || null,
    };
  }

  /**
   *
   * @returns {Array}
   */
  getHistoryList() {
    return this.history.map((command, index) => ({
      index,
      description: command.getDescription(),
      isCurrent: index === this.currentIndex,
      canUndo: command.canUndo(),
    }));
  }

  /**
   *
   * @param {number} targetIndex
   * @returns {boolean}
   */
  goToCommand(targetIndex) {
    if (targetIndex < -1 || targetIndex >= this.history.length) {
      return false;
    }

    while (this.currentIndex > targetIndex) {
      if (!this.undo()) {
        return false;
      }
    }

    while (this.currentIndex < targetIndex) {
      if (!this.redo()) {
        return false;
      }
    }

    return true;
  }

  /**
   *
   * @private
   */
  _trimHistory() {
    if (this.history.length > this.maxHistory) {
      const removeCount = this.history.length - this.maxHistory;
      this.history.splice(0, removeCount);
      this.currentIndex -= removeCount;
      this.savedIndex -= removeCount;

      this.currentIndex = Math.max(-1, this.currentIndex);
      this.savedIndex = Math.max(-1, this.savedIndex);
    }
  }

  /**
   *
   * @param {number} maxHistory
   */
  setMaxHistory(maxHistory) {
    if (maxHistory < 1) {
      throw new Error("Max history must be at least 1");
    }

    this.maxHistory = maxHistory;
    this._trimHistory();
  }

  /**
   *
   * @returns {Object}
   */
  getStatistics() {
    const commandTypes = {};
    this.history.forEach((command) => {
      const type = command.constructor.name;
      commandTypes[type] = (commandTypes[type] || 0) + 1;
    });

    return {
      totalCommands: this.history.length,
      commandTypes,
      averageCommandsPerSession:
        this.history.length / Math.max(1, this.getSessions()),
      memoryUsage: this._estimateMemoryUsage(),
    };
  }

  /**
   *
   * @returns {number}
   * @private
   */
  getSessions() {
    return 1;
  }

  /**
   *
   * @returns {string}
   * @private
   */
  _estimateMemoryUsage() {
    const bytesPerCommand = 100;
    const totalBytes = this.history.length * bytesPerCommand;

    if (totalBytes < 1024) {
      return `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      return `${(totalBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }
}
