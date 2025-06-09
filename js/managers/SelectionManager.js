class SelectionManager extends EventEmitter {
  constructor(editorElement = null) {
    super();
    this.editorElement = editorElement;
    this.savedSelections = [];
    this.maxSavedSelections = 10;

    this._bindEvents();
  }

  /**
   *
   * @param {HTMLElement} editorElement
   */
  setEditorElement(editorElement) {
    this.editorElement = editorElement;
    this._bindEvents();
  }

  /**
   *
   * @returns {Range|null}
   */
  saveSelection() {
    if (!this._isEditorFocused()) {
      return null;
    }

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const clonedRange = range.cloneRange();

      if (this._isRangeInEditor(clonedRange)) {
        this.emit("selectionSaved", clonedRange);
        return clonedRange;
      }
    }

    return null;
  }

  /**
   *
   * @param {Range} range
   * @returns {boolean}
   */
  restoreSelection(range) {
    if (!range || !this.editorElement) {
      return false;
    }

    try {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      this.editorElement.focus();

      this.emit("selectionRestored", range);
      return true;
    } catch (error) {
      console.warn("Failed to restore selection:", error);
      return false;
    }
  }

  /**
   *
   * @returns {string}
   */
  getSelectedText() {
    if (!this._isEditorFocused()) {
      return "";
    }

    const selection = window.getSelection();
    const selectedText = selection.toString();

    if (selectedText && this._isSelectionInEditor()) {
      return selectedText;
    }

    return "";
  }

  selectAll() {
    if (!this.editorElement) {
      return false;
    }

    const range = document.createRange();
    range.selectNodeContents(this.editorElement);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    this.emit("textSelected", "all");
    return true;
  }

  clearSelection() {
    const selection = window.getSelection();
    selection.removeAllRanges();
    this.emit("selectionCleared");
  }

  /**
   *
   * @param {number} start
   * @param {number} end
   * @returns {boolean}
   */
  selectRange(start, end) {
    if (!this.editorElement) {
      return false;
    }

    try {
      const range = this._createRangeFromPositions(start, end);
      if (range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        this.emit("rangeSelected", { start, end });
        return true;
      }
    } catch (error) {
      console.warn("Failed to select range:", error);
    }

    return false;
  }

  /**
   *
   * @returns {number}
   */
  getCursorPosition() {
    if (!this._isEditorFocused()) {
      return 0;
    }

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return this._getTextOffset(range.startContainer, range.startOffset);
    }

    return 0;
  }

  /**
   *
   * @param {number} position
   * @returns {boolean}
   */
  setCursorPosition(position) {
    if (!this.editorElement) {
      return false;
    }

    try {
      const range = this._createRangeFromPositions(position, position);
      if (range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        this.emit("cursorPositionChanged", position);
        return true;
      }
    } catch (error) {
      console.warn("Failed to set cursor position:", error);
    }

    return false;
  }

  /**
   *
   * @returns {Object}
   */
  getSelectionInfo() {
    const selectedText = this.getSelectedText();
    const range = this.saveSelection();

    if (!range) {
      return {
        hasSelection: false,
        text: "",
        length: 0,
        start: this.getCursorPosition(),
        end: this.getCursorPosition(),
      };
    }

    return {
      hasSelection: selectedText.length > 0,
      text: selectedText,
      length: selectedText.length,
      start: this._getTextOffset(range.startContainer, range.startOffset),
      end: this._getTextOffset(range.endContainer, range.endOffset),
      wordCount: selectedText
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length,
    };
  }

  /**
   *
   * @param {string} name
   */
  pushSelection(name = "") {
    const range = this.saveSelection();
    if (range) {
      this.savedSelections.push({
        name: name || `Selection ${this.savedSelections.length + 1}`,
        range: range,
        timestamp: Date.now(),
      });

      if (this.savedSelections.length > this.maxSavedSelections) {
        this.savedSelections.shift();
      }

      this.emit("selectionPushed", name);
    }
  }

  /**
   *
   * @returns {boolean}
   */
  popSelection() {
    if (this.savedSelections.length > 0) {
      const saved = this.savedSelections.pop();
      const restored = this.restoreSelection(saved.range);
      if (restored) {
        this.emit("selectionPopped", saved.name);
      }
      return restored;
    }
    return false;
  }

  /**
   *
   * @private
   */
  _bindEvents() {
    if (!this.editorElement) {
      return;
    }

    //
    document.addEventListener("selectionchange", () => {
      if (this._isSelectionInEditor()) {
        const info = this.getSelectionInfo();
        this.emit("selectionChanged", info);
      }
    });
  }

  /**
   *
   * @returns {boolean}
   * @private
   */
  _isEditorFocused() {
    return (
      this.editorElement &&
      (document.activeElement === this.editorElement ||
        this.editorElement.contains(document.activeElement))
    );
  }

  /**
   *
   * @returns {boolean}
   * @private
   */
  _isSelectionInEditor() {
    if (!this.editorElement) {
      return false;
    }

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return this._isRangeInEditor(range);
    }

    return false;
  }

  /**
   *
   * @param {Range} range
   * @returns {boolean}
   * @private
   */
  _isRangeInEditor(range) {
    return (
      this.editorElement.contains(range.commonAncestorContainer) ||
      this.editorElement === range.commonAncestorContainer
    );
  }

  /**
   *
   * @param {number} start
   * @param {number} end
   * @returns {Range|null}
   * @private
   */
  _createRangeFromPositions(start, end) {
    if (!this.editorElement) {
      return null;
    }

    const walker = document.createTreeWalker(
      this.editorElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const range = document.createRange();
    let currentOffset = 0;
    let startSet = false;

    let node;
    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent.length;

      if (!startSet && currentOffset + nodeLength >= start) {
        range.setStart(node, start - currentOffset);
        startSet = true;
      }

      if (currentOffset + nodeLength >= end) {
        range.setEnd(node, end - currentOffset);
        break;
      }

      currentOffset += nodeLength;
    }

    return startSet ? range : null;
  }

  /**
   *
   * @param {Node} node
   * @param {number} offset
   * @returns {number}
   * @private
   */
  _getTextOffset(node, offset) {
    if (!this.editorElement) {
      return 0;
    }

    const walker = document.createTreeWalker(
      this.editorElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let textOffset = 0;
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent.length;
    }

    return textOffset;
  }
}
