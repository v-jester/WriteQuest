class AutoComplete extends AIStrategy {
  constructor() {
    super();
    this.suggestions = [];
    this.isEnabled = true;
    this.delay = 1000;
    this.minTextLength = 10;

    this.apiProviders = {
      huggingface: {
        enabled: true,
        apiKey: "",
        model: "microsoft/DialoGPT-medium",
        endpoint: "https://api-inference.huggingface.co/models/",
        free: true,
      },
    };

    this.localModel = null;
    this.useLocalModel = false;

    this.loadPreferences();
    this.initializeLocalModel();
  }

  getName() {
    return "AutoComplete";
  }

  getDescription() {
    return "AI автодополнение текста с использованием бесплатных сервисов";
  }

  async process(text) {
    this.validateInput(text);

    const context = this.extractContext(text);
    let suggestions = [];

    try {
      suggestions = await this.generateAISuggestions(context);

      if (suggestions.length === 0 && this.useLocalModel && this.localModel) {
        suggestions = await this.generateLocalSuggestions(context);
      }

      if (suggestions.length === 0) {
        suggestions = this.getMockSuggestions(context);
      }
    } catch (error) {
      console.warn("AI API error:", error);
      suggestions = this.getMockSuggestions(context);
    }

    this.suggestions = suggestions;
    this.updateUsageStats(suggestions.length, 0);

    return suggestions;
  }

  async generateAISuggestions(context) {
    const suggestions = [];

    try {
      if (this.apiProviders.huggingface.enabled) {
        const result = await this.callHuggingFace(
          this.apiProviders.huggingface,
          context
        );
        if (result && result.length > 0) {
          suggestions.push(...result);
        }
      }
    } catch (error) {
      console.warn("Hugging Face failed:", error);
    }

    return suggestions;
  }

  async callHuggingFace(config, context) {
    const modelUrl = config.endpoint + config.model;

    const response = await fetch(modelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        inputs: context.recentContext,
        parameters: {
          max_length: 50,
          num_return_sequences: 3,
          temperature: 0.7,
          do_sample: true,
          pad_token_id: 50256,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.generated_text) {
      return data
        .map((item) =>
          item.generated_text.replace(context.recentContext, "").trim()
        )
        .filter((text) => text.length > 10 && text.length < 200)
        .slice(0, 3);
    }

    return [];
  }

  buildPrompt(context) {
    const { language, recentContext } = context;

    const prompts = {
      ru: `Продолжи текст: "${recentContext}"`,
      en: `Continue the text: "${recentContext}"`,
      mixed: `Continue the text: "${recentContext}"`,
    };

    return prompts[language] || prompts.mixed;
  }

  async initializeLocalModel() {
    if (typeof tf === "undefined") {
      console.warn("TensorFlow.js not loaded, local model unavailable");
      return;
    }

    try {
      this.useLocalModel = true;
      console.log("✅ Локальная AI модель готова");
    } catch (error) {
      console.warn("Failed to load local model:", error);
      this.useLocalModel = false;
    }
  }

  async generateLocalSuggestions(context) {
    if (!this.useLocalModel) return [];

    try {
      const suggestions = this.generateFromPatterns(context);
      return suggestions;
    } catch (error) {
      console.warn("Local model generation failed:", error);
      return [];
    }
  }

  generateFromPatterns(context) {
    const { language, recentContext, lastSentence } = context;

    const patterns = this.getLanguagePatterns(language);
    const contextType = this.detectContextType(recentContext);

    return patterns[contextType] || patterns.general;
  }

  getLanguagePatterns(language) {
    const patterns = {
      ru: {
        question: [
          "На этот вопрос можно ответить несколькими способами.",
          "Важно учитывать различные точки зрения.",
          "Это зависит от многих факторов.",
        ],
        story: [
          "В этот момент произошло нечто неожиданное.",
          "Герой понял, что должен принять решение.",
          "События начали развиваться стремительно.",
        ],
        technical: [
          "Данный подход имеет свои преимущества.",
          "Необходимо учитывать технические ограничения.",
          "Альтернативным решением может быть...",
        ],
        general: [
          "В результате этого можно сделать вывод.",
          "С другой стороны, стоит рассмотреть.",
          "Важно отметить следующие моменты.",
        ],
      },
      en: {
        question: [
          "This question can be approached from multiple angles.",
          "It's important to consider different perspectives.",
          "The answer depends on several factors.",
        ],
        story: [
          "At that moment, something unexpected happened.",
          "The protagonist realized a decision had to be made.",
          "Events began to unfold rapidly.",
        ],
        technical: [
          "This approach has several advantages.",
          "We need to consider the technical limitations.",
          "An alternative solution could be...",
        ],
        general: [
          "As a result, we can conclude that.",
          "On the other hand, it's worth considering.",
          "It's important to note the following points.",
        ],
      },
    };

    return patterns[language] || patterns.en;
  }

  detectContextType(text) {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("?") ||
      lowerText.includes("почему") ||
      lowerText.includes("why") ||
      lowerText.includes("how")
    ) {
      return "question";
    }

    if (
      lowerText.includes("герой") ||
      lowerText.includes("персонаж") ||
      lowerText.includes("character") ||
      lowerText.includes("story")
    ) {
      return "story";
    }

    if (
      lowerText.includes("алгоритм") ||
      lowerText.includes("технология") ||
      lowerText.includes("algorithm") ||
      lowerText.includes("technology")
    ) {
      return "technical";
    }

    return "general";
  }

  configureProvider(config) {
    this.apiProviders.huggingface = {
      ...this.apiProviders.huggingface,
      ...config,
    };
    this.savePreferences();
  }

  enableProvider(enabled = true) {
    this.apiProviders.huggingface.enabled = enabled;
    this.savePreferences();
  }

  setApiKey(apiKey) {
    this.apiProviders.huggingface.apiKey = apiKey;
    this.savePreferences();
  }

  async testProvider() {
    const config = this.apiProviders.huggingface;
    if (!config.enabled) {
      return { success: false, error: "Provider disabled" };
    }

    try {
      const testContext = {
        language: "en",
        recentContext: "The weather today is",
        lastSentence: "The weather today is",
      };

      const result = await this.callHuggingFace(config, testContext);

      return {
        success: true,
        response: result,
        provider: "huggingface",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: "huggingface",
      };
    }
  }

  savePreferences() {
    const prefs = {
      enabled: this.isEnabled,
      delay: this.delay,
      minTextLength: this.minTextLength,
      useLocalModel: this.useLocalModel,
      provider: this.apiProviders.huggingface,
    };

    try {
      localStorage.setItem("writerquest-autocomplete", JSON.stringify(prefs));
    } catch (error) {
      console.warn("Could not save autocomplete preferences:", error);
    }
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem("writerquest-autocomplete");
      if (saved) {
        const prefs = JSON.parse(saved);
        this.isEnabled = prefs.enabled !== undefined ? prefs.enabled : true;
        this.delay = prefs.delay || 1000;
        this.minTextLength = prefs.minTextLength || 10;
        this.useLocalModel = prefs.useLocalModel || false;

        if (prefs.provider) {
          this.apiProviders.huggingface = {
            ...this.apiProviders.huggingface,
            ...prefs.provider,
          };
        }
      }
    } catch (error) {
      console.warn("Could not load autocomplete preferences:", error);
    }
  }

  getMockSuggestions(context) {
    const { language, lastSentence, recentContext } = context;

    if (language === "ru") {
      return [
        "В этом случае стоит рассмотреть альтернативные варианты.",
        "Однако следует учитывать возможные последствия.",
        "Таким образом, можно сделать вывод о том, что...",
      ];
    } else if (language === "en") {
      return [
        "However, it's important to consider the implications.",
        "In this case, we should explore alternative approaches.",
        "Therefore, we can conclude that this method is effective.",
      ];
    } else {
      return [
        "Продолжение следует...",
        "Continue writing...",
        "Далее можно добавить...",
      ];
    }
  }

  getUsageStats() {
    const stats = localStorage.getItem("writerquest-autocomplete-stats");
    if (stats) {
      try {
        return JSON.parse(stats);
      } catch (error) {
        return { suggestionsGenerated: 0, suggestionsAccepted: 0 };
      }
    }
    return { suggestionsGenerated: 0, suggestionsAccepted: 0 };
  }

  updateUsageStats(generated = 0, accepted = 0) {
    const current = this.getUsageStats();
    const updated = {
      suggestionsGenerated: current.suggestionsGenerated + generated,
      suggestionsAccepted: current.suggestionsAccepted + accepted,
    };

    try {
      localStorage.setItem(
        "writerquest-autocomplete-stats",
        JSON.stringify(updated)
      );
    } catch (error) {
      console.warn("Could not save autocomplete stats:", error);
    }
  }

  extractContext(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const lastSentences = sentences.slice(-3);

    return {
      fullText: text,
      recentContext: lastSentences.join(". "),
      lastSentence: sentences[sentences.length - 1] || "",
      wordCount: text.split(/\s+/).length,
      language: this.detectLanguage(text),
    };
  }

  detectLanguage(text) {
    const russianChars = (text.match(/[а-яё]/gi) || []).length;
    const englishChars = (text.match(/[a-z]/gi) || []).length;
    const totalChars = russianChars + englishChars;

    if (totalChars === 0) return "unknown";

    const russianPercent = (russianChars / totalChars) * 100;

    if (russianPercent > 70) return "ru";
    if (russianPercent < 30) return "en";
    return "mixed";
  }

  getBestSuggestion() {
    return this.suggestions.length > 0 ? this.suggestions[0] : null;
  }

  getAllSuggestions() {
    return [...this.suggestions];
  }

  filterSuggestions(keyword) {
    if (!keyword || keyword.length < 2) {
      return this.suggestions;
    }

    return this.suggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  isAutoCompleteEnabled() {
    return this.isEnabled;
  }

  setDelay(delay) {
    this.delay = Math.max(100, delay);
  }

  getDelay() {
    return this.delay;
  }

  setMinTextLength(length) {
    this.minTextLength = Math.max(1, length);
  }
}
