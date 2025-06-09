class Strategy {
  /**
   *
   * @param {...any} args
   * @returns {Promise<any>}
   * @abstract
   */
  async execute(...args) {
    throw new Error("execute() method must be implemented in subclass");
  }

  /**
   *
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }

  /**
   *
   * @returns {string}
   */
  getDescription() {
    return "Base strategy";
  }

  /**
   *
   * @param {any} data
   * @returns {boolean}
   */
  supports(data) {
    return true;
  }
}

/**
 *
 */
class AIStrategy extends Strategy {
  /**
   *
   * @param {string} text
   * @returns {Promise<any>}
   * @abstract
   */
  async process(text) {
    throw new Error(
      "process() method must be implemented in AI strategy subclass"
    );
  }

  /**
   *
   * @param {string} text
   * @returns {Promise<any>}
   */
  async execute(text) {
    return this.process(text);
  }

  /**
   *
   * @param {string} text
   * @returns {boolean}
   */
  supports(text) {
    return typeof text === "string" && text.length > 0;
  }

  /**
   *
   * @returns {number}
   */
  getMinTextLength() {
    return 1;
  }

  /**
   *
   * @returns {number}
   */
  getMaxTextLength() {
    return 10000;
  }

  /**
   *
   * @param {string} text
   * @throws {Error}
   */
  validateInput(text) {
    if (!this.supports(text)) {
      throw new Error("Unsupported input type");
    }

    if (text.length < this.getMinTextLength()) {
      throw new Error(
        `Text too short. Minimum length: ${this.getMinTextLength()}`
      );
    }

    if (text.length > this.getMaxTextLength()) {
      throw new Error(
        `Text too long. Maximum length: ${this.getMaxTextLength()}`
      );
    }
  }
}

/**
 *
 */
class StrategyContext {
  constructor(strategy = null) {
    this.strategy = strategy;
    this.strategies = new Map();
  }

  /**
   *
   * @param {Strategy} strategy
   */
  setStrategy(strategy) {
    if (!(strategy instanceof Strategy)) {
      throw new Error("Strategy must be an instance of Strategy class");
    }
    this.strategy = strategy;
  }

  /**
   *
   * @param {string} name
   * @param {Strategy} strategy
   */
  registerStrategy(name, strategy) {
    if (!(strategy instanceof Strategy)) {
      throw new Error("Strategy must be an instance of Strategy class");
    }
    this.strategies.set(name, strategy);
  }

  /**
   *
   * @param {string} name
   */
  useStrategy(name) {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Strategy '${name}' not found`);
    }
    this.strategy = strategy;
  }

  /**
   *
   * @param {...any} args
   * @returns {Promise<any>}
   */
  async execute(...args) {
    if (!this.strategy) {
      throw new Error("No strategy set");
    }
    return this.strategy.execute(...args);
  }

  /**
   *
   * @returns {string[]}
   */
  getAvailableStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   *
   * @returns {Strategy|null}
   */
  getCurrentStrategy() {
    return this.strategy;
  }
}
