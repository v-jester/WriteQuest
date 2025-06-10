class TextImprover extends AIStrategy {
  constructor() {
    super();
    this.improvementTypes = ["grammar", "style", "clarity", "conciseness"];
    this.isEnabled = true;

    this.apiProviders = {
      languagetool: {
        enabled: true,
        endpoint: "https://api.languagetool.org/v2/check",
        language: "auto",
        free: true,
      },

      huggingface: {
        enabled: true,
        model: "grammarly/coedit-large",
        endpoint: "https://api-inference.huggingface.co/models/",
        free: true,
      },
    };

    this.localLibraries = {
      compromise: null,
      textstat: null,
    };

    this.loadPreferences();
    this.initializeLocalLibraries();
  }

  getName() {
    return "TextImprover";
  }

  getDescription() {
    return "AI улучшение текста с использованием бесплатных сервисов";
  }

  async process(text) {
    this.validateInput(text);

    const analysis = this.analyzeText(text);
    const improvements = await this.generateImprovements(text, analysis);

    return {
      originalText: text,
      analysis: analysis,
      improvements: improvements,
      improvedText: improvements.text || text,
    };
  }

  async generateImprovements(text, analysis) {
    const improvements = {
      text: text,
      changes: [],
      score: analysis.readabilityScore,
      corrections: {
        grammar: [],
        spelling: [],
        style: [],
        clarity: [],
      },
    };

    try {
      const grammarCorrections = await this.checkGrammar(text);
      improvements.corrections.grammar = grammarCorrections.grammar || [];
      improvements.corrections.spelling = grammarCorrections.spelling || [];

      const styleImprovements = await this.improveStyleWithHuggingFace(text);
      improvements.corrections.style = styleImprovements;

      improvements.text = await this.applyAllImprovements(
        text,
        improvements.corrections
      );

      const newAnalysis = this.analyzeText(improvements.text);
      improvements.score = newAnalysis.readabilityScore;

      improvements.changes = this.generateChangesList(improvements.corrections);
    } catch (error) {
      console.warn("AI improvement error:", error);
      improvements.text = this.applyBasicImprovements(text);
      improvements.score = analysis.readabilityScore + 5;
    }

    return improvements;
  }

  async checkGrammar(text) {
    const results = {
      grammar: [],
      spelling: [],
    };

    const language = this.detectLanguage(text);

    try {
      if (language === "ru" && this.apiProviders.yandex.enabled) {
        const yandexResults = await this.checkWithYandexSpeller(text);
        results.spelling.push(...yandexResults);
      }

      if (this.apiProviders.languagetool.enabled) {
        const languageToolResults = await this.checkWithLanguageTool(
          text,
          language
        );
        results.grammar.push(...languageToolResults.grammar);
        results.spelling.push(...languageToolResults.spelling);
      }
    } catch (error) {
      console.warn("Grammar check failed:", error);
    }

    return results;
  }

  async checkWithYandexSpeller(text) {
    try {
      const response = await fetch(this.apiProviders.yandex.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text: text,
          lang: "ru",
          format: "plain",
          options: "518",
        }),
      });

      if (!response.ok) {
        throw new Error(`Yandex Speller error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((error) => ({
        type: "spelling",
        word: error.word,
        suggestions: error.s || [],
        position: error.pos,
        length: error.len,
        code: error.code,
        explanation: this.getYandexErrorExplanation(error.code),
      }));
    } catch (error) {
      console.warn("Yandex Speller failed:", error);
      return [];
    }
  }

  getYandexErrorExplanation(code) {
    const codes = {
      1: "Неизвестное слово",
      2: "Повтор слова",
      3: "Неправильное использование заглавных букв",
      4: "Слишком много ошибок",
    };
    return codes[code] || "Ошибка";
  }

  async checkWithLanguageTool(text, language = "auto") {
    try {
      const response = await fetch(this.apiProviders.languagetool.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text: text,
          language:
            language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "auto",
          enabledOnly: "false",
        }),
      });

      if (!response.ok) {
        throw new Error(`LanguageTool error: ${response.status}`);
      }

      const data = await response.json();

      const grammar = [];
      const spelling = [];

      data.matches?.forEach((match) => {
        const correction = {
          type: match.rule.category.name.toLowerCase().includes("spelling")
            ? "spelling"
            : "grammar",
          message: match.message,
          suggestions: match.replacements?.map((r) => r.value) || [],
          position: match.offset,
          length: match.length,
          context: match.context?.text || "",
          rule: match.rule.id,
        };

        if (correction.type === "spelling") {
          spelling.push(correction);
        } else {
          grammar.push(correction);
        }
      });

      return { grammar, spelling };
    } catch (error) {
      console.warn("LanguageTool failed:", error);
      return { grammar: [], spelling: [] };
    }
  }

  async improveStyleWithHuggingFace(text) {
    const improvements = [];

    try {
      if (this.apiProviders.huggingface.enabled) {
        const hfImprovements = await this.improveWithHuggingFace(text, "style");
        improvements.push(...hfImprovements);
      }
    } catch (error) {
      console.warn("Style improvement failed:", error);
    }

    return improvements;
  }

  async improveWithHuggingFace(text, type = "style") {
    try {
      const modelUrl =
        this.apiProviders.huggingface.endpoint +
        this.apiProviders.huggingface.model;

      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            task: "text-editing",
            max_length: Math.min(text.length + 50, 500),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Hugging Face error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data[0]?.generated_text) {
        const improvedText = data[0].generated_text.trim();

        if (improvedText !== text && improvedText.length > text.length * 0.8) {
          return [
            {
              type: type,
              original: text,
              improved: improvedText,
              explanation: `Улучшено с помощью Hugging Face модели`,
            },
          ];
        }
      }

      return [];
    } catch (error) {
      console.warn("Hugging Face improvement failed:", error);
      return [];
    }
  }

  async applyAllImprovements(text, corrections) {
    let improvedText = text;

    try {
      for (const correction of corrections.spelling) {
        if (correction.suggestions && correction.suggestions.length > 0) {
          const original = text.substring(
            correction.position,
            correction.position + correction.length
          );
          improvedText = improvedText.replace(
            original,
            correction.suggestions[0]
          );
        }
      }

      for (const correction of corrections.grammar) {
        if (correction.suggestions && correction.suggestions.length > 0) {
          const original = text.substring(
            correction.position,
            correction.position + correction.length
          );
          improvedText = improvedText.replace(
            original,
            correction.suggestions[0]
          );
        }
      }

      if (corrections.style.length > 0) {
        const bestStyleImprovement = corrections.style[0];
        if (bestStyleImprovement.improved) {
          improvedText = bestStyleImprovement.improved;
        }
      }

      improvedText = this.applyBasicImprovements(improvedText);
    } catch (error) {
      console.warn("Error applying improvements:", error);
      return this.applyBasicImprovements(text);
    }

    return improvedText;
  }

  applyBasicImprovements(text) {
    let improved = text;

    improved = improved.replace(/\s{2,}/g, " ");

    improved = improved.replace(/\s+([.,!?;:])/g, "$1");

    improved = improved.replace(/([.,!?;:])([^\s\n])/g, "$1 $2");

    improved = improved.replace(/\.\s*([a-zа-я])/g, (match, letter) => {
      return ". " + letter.toUpperCase();
    });

    return improved.trim();
  }

  generateChangesList(corrections) {
    const changes = [];

    ["spelling", "grammar", "style"].forEach((type) => {
      corrections[type].forEach((correction) => {
        changes.push({
          type: type,
          original: correction.original || correction.word || "Фрагмент текста",
          improved:
            correction.improved || correction.suggestions?.[0] || "Исправлено",
          explanation:
            correction.explanation ||
            correction.message ||
            this.getImprovementExplanation(type),
          position: correction.position,
          confidence: this.calculateCorrectionConfidence(correction),
        });
      });
    });

    return changes.sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  calculateCorrectionConfidence(correction) {
    if (correction.type === "spelling" && correction.suggestions?.length > 0) {
      return 0.9;
    }
    if (correction.type === "grammar" && correction.rule) {
      return 0.8;
    }
    if (correction.type === "style") {
      return 0.7;
    }
    return 0.5;
  }

  getImprovementExplanation(issueType) {
    const explanations = {
      spelling: "Исправлена орфографическая ошибка.",
      grammar: "Исправлена грамматическая ошибка.",
      style: "Улучшен стиль изложения для лучшего восприятия.",
    };

    return explanations[issueType] || "Текст улучшен для лучшего восприятия.";
  }

  async initializeLocalLibraries() {
    try {
      if (typeof nlp === "undefined") {
        await this.loadScript(
          "https://unpkg.com/compromise@latest/builds/compromise.min.js"
        );
      }
      this.localLibraries.compromise = window.nlp;

      console.log("✅ Локальные библиотеки для улучшения текста загружены");
    } catch (error) {
      console.warn("Failed to load local libraries:", error);
    }
  }

  async loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  analyzeText(text) {
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    const analysis = {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      averageWordsPerSentence:
        sentences.length > 0 ? words.length / sentences.length : 0,
      averageSentencesPerParagraph:
        paragraphs.length > 0 ? sentences.length / paragraphs.length : 0,
      readabilityScore: this.calculateReadabilityScore(text),
      issues: this.findIssues(text),
      suggestions: this.generateSuggestions(text),
    };

    if (this.localLibraries.compromise) {
      try {
        const doc = this.localLibraries.compromise(text);
        analysis.nlp = {
          sentences: doc.sentences().length,
          nouns: doc.nouns().length,
          verbs: doc.verbs().length,
          adjectives: doc.adjectives().length,
          topics: doc.topics().out("array"),
          people: doc.people().out("array"),
          places: doc.places().out("array"),
        };
      } catch (error) {
        console.warn("NLP analysis failed:", error);
      }
    }

    return analysis;
  }

  calculateReadabilityScore(text) {
    const words = text.split(/\s+/).length;
    const sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0).length;
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 0;

    const score =
      206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);

    return Math.max(0, Math.min(100, score));
  }

  countSyllables(text) {
    const vowels = /[аеёиоуыэюяaeiouy]/gi;
    return (text.match(vowels) || []).length;
  }

  findIssues(text) {
    const issues = [];

    const wordRepeats = this.findWordRepeats(text);
    if (wordRepeats.length > 0) {
      issues.push({
        type: "repetition",
        severity: "medium",
        message: "Обнаружены повторяющиеся слова",
        details: wordRepeats,
      });
    }

    const longSentences = this.findLongSentences(text);
    if (longSentences.length > 0) {
      issues.push({
        type: "sentence_length",
        severity: "low",
        message: "Найдены слишком длинные предложения",
        details: longSentences,
      });
    }

    const bureaucracy = this.findBureaucracy(text);
    if (bureaucracy.length > 0) {
      issues.push({
        type: "bureaucracy",
        severity: "medium",
        message: "Найдены канцеляризмы и штампы",
        details: bureaucracy,
      });
    }

    return issues;
  }

  findWordRepeats(text) {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    const wordCounts = {};
    const repeats = [];

    words.forEach((word) => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    Object.entries(wordCounts).forEach(([word, count]) => {
      if (count > 2) {
        repeats.push({ word, count });
      }
    });

    return repeats;
  }

  findLongSentences(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return sentences
      .map((sentence, index) => ({ sentence: sentence.trim(), index }))
      .filter((item) => item.sentence.split(/\s+/).length > 25);
  }

  findBureaucracy(text) {
    const bureaucraticPhrases = [
      "в целях",
      "в связи с",
      "в соответствии с",
      "в рамках",
      "имеет место",
      "осуществить",
      "произвести",
      "данный",
      "указанный",
      "настоящий",
    ];

    const found = [];
    bureaucraticPhrases.forEach((phrase) => {
      const regex = new RegExp(phrase, "gi");
      const matches = text.match(regex);
      if (matches) {
        found.push({ phrase, count: matches.length });
      }
    });

    return found;
  }

  generateSuggestions(text) {
    const suggestions = [];

    const readabilityScore = this.calculateReadabilityScore(text);
    if (readabilityScore < 30) {
      suggestions.push({
        type: "readability",
        priority: "high",
        message:
          "Текст сложен для восприятия. Рекомендуется упростить предложения.",
        action:
          "Разбейте длинные предложения на короткие, используйте простые слова.",
      });
    }

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgWordsPerSentence = text.split(/\s+/).length / sentences.length;

    if (avgWordsPerSentence > 20) {
      suggestions.push({
        type: "structure",
        priority: "medium",
        message: "Предложения слишком длинные.",
        action: "Старайтесь делать предложения короче (до 15-20 слов).",
      });
    }

    return suggestions;
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

  async testService(service) {
    const testText =
      "Этот текст содержит ошибку и нуждается в улучшении стиля.";

    try {
      switch (service) {
        case "languagetool":
          return await this.checkWithLanguageTool(testText, "ru");
        case "yandex":
          return await this.checkWithYandexSpeller(testText);
        case "huggingface":
          return await this.improveWithHuggingFace(testText, "style");
        default:
          throw new Error(`Unknown service: ${service}`);
      }
    } catch (error) {
      return { error: error.message, success: false };
    }
  }

  enableProvider(provider, enabled = true) {
    if (this.apiProviders[provider]) {
      this.apiProviders[provider].enabled = enabled;
      this.savePreferences();
    }
  }

  getServicesStatus() {
    return Object.entries(this.apiProviders).map(([name, config]) => ({
      name,
      enabled: config.enabled,
      free: config.free,
      description: this.getServiceDescription(name),
    }));
  }

  getServiceDescription(service) {
    const descriptions = {
      languagetool:
        "Проверка грамматики и стиля (бесплатно до 20 запросов/мин)",
      yandex: "Проверка орфографии русского языка (полностью бесплатно)",
      huggingface: "AI улучшение текста (бесплатно, возможны задержки)",
    };
    return descriptions[service] || "Неизвестный сервис";
  }

  savePreferences() {
    const prefs = {
      enabled: this.isEnabled,
      improvementTypes: this.improvementTypes,
      providers: this.apiProviders,
    };

    try {
      localStorage.setItem("writerquest-textimprover", JSON.stringify(prefs));
    } catch (error) {
      console.warn("Could not save text improver preferences:", error);
    }
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem("writerquest-textimprover");
      if (saved) {
        const prefs = JSON.parse(saved);
        this.isEnabled = prefs.enabled !== undefined ? prefs.enabled : true;
        this.improvementTypes = prefs.improvementTypes || ["grammar", "style"];

        if (prefs.providers) {
          Object.keys(prefs.providers).forEach((provider) => {
            if (this.apiProviders[provider]) {
              this.apiProviders[provider] = {
                ...this.apiProviders[provider],
                ...prefs.providers[provider],
              };
            }
          });
        }
      }
    } catch (error) {
      console.warn("Could not load text improver preferences:", error);
    }
  }

  generateImprovementReport(original, improved) {
    const originalAnalysis = this.analyzeText(original);
    const improvedAnalysis = this.analyzeText(improved);

    return {
      timestamp: new Date().toISOString(),
      original: {
        wordCount: originalAnalysis.wordCount,
        readabilityScore: originalAnalysis.readabilityScore,
        issues: originalAnalysis.issues.length,
      },
      improved: {
        wordCount: improvedAnalysis.wordCount,
        readabilityScore: improvedAnalysis.readabilityScore,
        issues: improvedAnalysis.issues.length,
      },
      improvements: {
        readabilityChange:
          improvedAnalysis.readabilityScore - originalAnalysis.readabilityScore,
        issuesFixed:
          originalAnalysis.issues.length - improvedAnalysis.issues.length,
        wordCountChange:
          improvedAnalysis.wordCount - originalAnalysis.wordCount,
      },
      summary: this.generateRecommendations({
        original: originalAnalysis,
        improved: improvedAnalysis,
      }),
    };
  }

  generateRecommendations(comparison) {
    const recommendations = [];

    if (comparison.improved.readabilityScore < 50) {
      recommendations.push(
        "Рекомендуется дальнейшее упрощение текста для лучшей читабельности."
      );
    }

    if (comparison.improved.issues.length > 0) {
      recommendations.push("Остались проблемы, требующие внимания.");
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Текст значительно улучшен и готов к использованию."
      );
    }

    return recommendations;
  }

  async improveLargeText(text, chunkSize = 1000) {
    if (text.length <= chunkSize) {
      return await this.process(text);
    }

    const chunks = this.splitTextIntoChunks(text, chunkSize);
    const improvedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await this.process(chunks[i]);
        improvedChunks.push(result.improvedText);

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`Failed to improve chunk ${i}:`, error);
        improvedChunks.push(chunks[i]);
      }
    }

    return {
      originalText: text,
      improvedText: improvedChunks.join(" "),
      chunks: improvedChunks.length,
      analysis: this.analyzeText(improvedChunks.join(" ")),
    };
  }

  splitTextIntoChunks(text, chunkSize) {
    const sentences = text.split(/[.!?]+/);
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence + ". ";
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  setImprovementTypes(types) {
    this.improvementTypes = types.filter((type) =>
      ["grammar", "style", "clarity"].includes(type)
    );
  }

  getImprovementTypes() {
    return [...this.improvementTypes];
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  isImproverEnabled() {
    return this.isEnabled;
  }
}
