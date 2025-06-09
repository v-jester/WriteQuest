class Command {
  /**
   *
   * @abstract
   */
  execute() {
    throw new Error("execute() method must be implemented in subclass");
  }

  /**
   *
   * @abstract
   */
  undo() {
    throw new Error("undo() method must be implemented in subclass");
  }

  /**
   *
   * @returns {boolean}
   */
  canUndo() {
    return true;
  }

  /**
   *
   * @returns {string}
   */
  getDescription() {
    return this.constructor.name;
  }
}

/**
 *
 */
class MacroCommand extends Command {
  constructor(commands = []) {
    super();
    this.commands = commands;
  }

  /**
   *
   * @param {Command} command
   */
  addCommand(command) {
    this.commands.push(command);
  }

  /**
   *
   */
  execute() {
    for (const command of this.commands) {
      command.execute();
    }
  }

  /**
   *
   */
  undo() {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  /**
   *
   * @returns {boolean}
   */
  canUndo() {
    return this.commands.every((command) => command.canUndo());
  }

  /**
   *
   * @returns {string}
   */
  getDescription() {
    return `Macro: ${this.commands
      .map((cmd) => cmd.getDescription())
      .join(", ")}`;
  }
}

/**
 *
 */
class NullCommand extends Command {
  execute() {}

  undo() {}

  canUndo() {
    return false;
  }

  getDescription() {
    return "No Operation";
  }
}
