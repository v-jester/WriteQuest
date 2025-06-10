class SentimentAnalysis extends AIStrategy {
  constructor() {
    super();
    this.isEnabled = true;
    this.language = "auto";

    this.apiProviders = {
      huggingface: {
        enabled: true,
        model: "cardiffnlp/twitter-roberta-base-sentiment-latest",
        endpoint: "https://api-inference.huggingface.co/models/",
        free: true,
      },

      vader: {
        enabled: true,
        local: true,
      },
    };

    this.localModels = {
      compromise: null,
      vader: null,
    };

    this.initializeDictionaries();
    this.loadPreferences();
    this.initializeLocalModels();
  }

  getName() {
    return "SentimentAnalysis";
  }

  getDescription() {
    return "Анализ эмоциональной окраски текста с использованием бесплатных сервисов";
  }

  async process(text) {
    this.validateInput(text);

    const language = this.detectLanguage(text);
    let analysis = null;

    try {
      analysis = await this.analyzeWithExternalAPIs(text, language);

      if (!analysis) {
        analysis = await this.analyzeWithLocalMethods(text, language);
      }

      if (!analysis) {
        analysis = this.analyzeSentiment(text, language);
      }

      analysis.emotions = await this.analyzeEmotions(text, language);
      analysis.topics = await this.extractTopics(text);
      analysis.keywords = this.extractKeywords(text, analysis);
    } catch (error) {
      console.warn("Sentiment analysis error:", error);
      analysis = this.analyzeSentiment(text, language);
    }

    return {
      sentiment: analysis.sentiment,
      score: analysis.score,
      confidence: analysis.confidence,
      language: language,
      emotions: analysis.emotions || {},
      topics: analysis.topics || [],
      keywords: analysis.keywords || {},
      summary: this.generateSummary(analysis),
      details: analysis.details || {},
    };
  }

  async analyzeWithExternalAPIs(text, language) {
    try {
      if (this.apiProviders.huggingface.enabled) {
        const result = await this.analyzeWithHuggingFace(
          this.apiProviders.huggingface,
          text
        );
        if (result) {
          result.provider = "huggingface";
          return result;
        }
      }
    } catch (error) {
      console.warn("Hugging Face failed:", error);
    }

    return null;
  }

  async analyzeWithHuggingFace(config, text) {
    const modelUrl = config.endpoint + config.model;

    try {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            return_all_scores: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data[0]) {
        const scores = data[0];
        const sentiment = this.mapHuggingFaceSentiment(scores);

        return {
          sentiment: sentiment.label,
          score: sentiment.score,
          confidence: sentiment.confidence,
          details: {
            scores: scores,
            model: config.model,
          },
        };
      }

      return null;
    } catch (error) {
      console.warn("Hugging Face sentiment analysis failed:", error);
      return null;
    }
  }

  mapHuggingFaceSentiment(scores) {
    const maxScore = Math.max(...scores.map((s) => s.score));
    const bestResult = scores.find((s) => s.score === maxScore);

    let sentiment = "neutral";
    let normalizedScore = 0;

    if (
      bestResult.label.includes("2") ||
      bestResult.label.toLowerCase().includes("pos")
    ) {
      sentiment = "positive";
      normalizedScore = bestResult.score;
    } else if (
      bestResult.label.includes("0") ||
      bestResult.label.toLowerCase().includes("neg")
    ) {
      sentiment = "negative";
      normalizedScore = -bestResult.score;
    } else {
      sentiment = "neutral";
      normalizedScore = 0;
    }

    return {
      label: sentiment,
      score: normalizedScore,
      confidence: bestResult.score,
    };
  }

  async analyzeWithLocalMethods(text, language) {
    let analysis = null;

    if (this.apiProviders.vader.enabled && this.localModels.vader) {
      analysis = await this.analyzeWithVADER(text);
    }

    if (!analysis && this.localModels.compromise) {
      analysis = this.analyzeWithCompromise(text);
    }

    return analysis;
  }

  async initializeLocalModels() {
    try {
      if (typeof vaderSentiment === "undefined") {
        await this.loadScript(
          "https://cdn.jsdelivr.net/npm/vader-sentiment@1.1.5/dist/vaderSentiment.min.js"
        );
      }
      this.localModels.vader = window.vaderSentiment;

      if (typeof nlp === "undefined") {
        await this.loadScript(
          "https://unpkg.com/compromise@latest/builds/compromise.min.js"
        );
      }
      this.localModels.compromise = window.nlp;

      console.log("✅ Локальные модели для анализа тональности загружены");
    } catch (error) {
      console.warn("Failed to load local sentiment models:", error);
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

  async analyzeWithVADER(text) {
    if (!this.localModels.vader) return null;

    try {
      const scores =
        this.localModels.vader.SentimentIntensityAnalyzer.polarity_scores(text);

      let sentiment = "neutral";
      if (scores.compound >= 0.05) sentiment = "positive";
      else if (scores.compound <= -0.05) sentiment = "negative";

      return {
        sentiment,
        score: scores.compound,
        confidence: Math.abs(scores.compound),
        details: {
          positive: scores.pos,
          negative: scores.neg,
          neutral: scores.neu,
          compound: scores.compound,
        },
      };
    } catch (error) {
      console.warn("VADER analysis failed:", error);
      return null;
    }
  }

  analyzeWithCompromise(text) {
    if (!this.localModels.compromise) return null;

    try {
      const doc = this.localModels.compromise(text);
      const sentimentData = doc.sentiment();

      return {
        sentiment: sentimentData.out("text") || "neutral",
        score: sentimentData.out("number") || 0,
        confidence: 0.6,
        details: {
          method: "compromise",
          tokens: doc.terms().length,
        },
      };
    } catch (error) {
      console.warn("Compromise analysis failed:", error);
      return null;
    }
  }

  analyzeSentiment(text, language) {
    const words = this.tokenizeText(text);
    const scores = this.calculateWordScores(words, language);
    const emojiScores = this.analyzeEmojis(text);
    const contextAnalysis = this.analyzeContext(text, language);

    const totalScore = scores.total + emojiScores.total + contextAnalysis.score;
    const maxPossibleScore = Math.max(words.length, 1);
    const normalizedScore = totalScore / maxPossibleScore;

    let sentiment = "neutral";
    if (normalizedScore > 0.1) sentiment = "positive";
    else if (normalizedScore < -0.1) sentiment = "negative";

    const confidence = Math.min(Math.abs(normalizedScore) * 2, 1);

    return {
      sentiment,
      score: normalizedScore,
      confidence,
      details: {
        wordScores: scores,
        emojiScores,
        contextAnalysis,
      },
    };
  }

  tokenizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  calculateWordScores(words, language) {
    const scores = { positive: 0, negative: 0, neutral: 0, total: 0 };
    const keywords = { positive: [], negative: [], neutral: [] };

    const posWords = this.positiveWords[language] || [];
    const negWords = this.negativeWords[language] || [];
    const neuWords = this.neutralWords[language] || [];

    words.forEach((word) => {
      if (posWords.includes(word)) {
        scores.positive += 1;
        scores.total += 1;
        keywords.positive.push(word);
      } else if (negWords.includes(word)) {
        scores.negative += 1;
        scores.total -= 1;
        keywords.negative.push(word);
      } else if (neuWords.includes(word)) {
        scores.neutral += 1;
        keywords.neutral.push(word);
      }
    });

    return { ...scores, keywords };
  }

  analyzeEmojis(text) {
    const emojis =
      text.match(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
      ) || [];

    let total = 0;
    const found = [];

    emojis.forEach((emoji) => {
      const score = this.emojiSentiment[emoji];
      if (score !== undefined) {
        total += score;
        found.push({ emoji, score });
      }
    });

    return { total, count: emojis.length, found };
  }

  analyzeContext(text, language) {
    let score = 0;
    const patterns = [];

    const negationPatterns =
      language === "ru"
        ? [/не\s+\w+/gi, /нет\s+\w+/gi, /без\s+\w+/gi]
        : [/not\s+\w+/gi, /no\s+\w+/gi, /without\s+\w+/gi];

    negationPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        score -= matches.length * 0.2;
        patterns.push({ type: "negation", count: matches.length });
      }
    });

    const amplifierPatterns =
      language === "ru"
        ? [/очень\s+\w+/gi, /крайне\s+\w+/gi, /весьма\s+\w+/gi]
        : [/very\s+\w+/gi, /extremely\s+\w+/gi, /highly\s+\w+/gi];

    amplifierPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 0.1;
        patterns.push({ type: "amplifier", count: matches.length });
      }
    });

    return { score, patterns };
  }

  async analyzeEmotions(text, language) {
    let emotions = this.basicAnalyzeEmotions(text, language);

    try {
      if (this.apiProviders.huggingface.enabled) {
        const emotionAnalysis = await this.analyzeEmotionsWithHuggingFace(text);
        if (emotionAnalysis) {
          emotions = { ...emotions, ...emotionAnalysis };
        }
      }
    } catch (error) {
      console.warn("External emotion analysis failed:", error);
    }

    return emotions;
  }

  async analyzeEmotionsWithHuggingFace(text) {
    try {
      const emotionModelUrl =
        "https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base";

      const response = await fetch(emotionModelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            return_all_scores: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Emotion analysis error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data[0]) {
        const emotions = {};
        data[0].forEach((emotion) => {
          emotions[emotion.label.toLowerCase()] = emotion.score;
        });
        return emotions;
      }

      return null;
    } catch (error) {
      console.warn("Hugging Face emotion analysis failed:", error);
      return null;
    }
  }

  basicAnalyzeEmotions(text, language) {
    const emotions = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
    };

    const emotionDictionaries = {
      ru: {
        joy: [
          "радость",
          "веселье",
          "счастье",
          "восторг",
          "ликование",
          "блаженство",
          "эйфория",
        ],
        sadness: [
          "грусть",
          "печаль",
          "тоска",
          "уныние",
          "скорбь",
          "меланхолия",
          "депрессия",
        ],
        anger: [
          "злость",
          "гнев",
          "ярость",
          "раздражение",
          "бешенство",
          "негодование",
          "возмущение",
        ],
        fear: [
          "страх",
          "боязнь",
          "ужас",
          "тревога",
          "паника",
          "испуг",
          "опасение",
        ],
        surprise: [
          "удивление",
          "изумление",
          "поразительно",
          "неожиданно",
          "шок",
          "ошеломление",
        ],
        disgust: [
          "отвращение",
          "омерзение",
          "тошнота",
          "противно",
          "мерзко",
          "гадость",
        ],
      },
      en: {
        joy: [
          "joy",
          "happiness",
          "cheerful",
          "delight",
          "bliss",
          "ecstasy",
          "euphoria",
        ],
        sadness: [
          "sadness",
          "sorrow",
          "melancholy",
          "grief",
          "depression",
          "despair",
        ],
        anger: [
          "anger",
          "rage",
          "fury",
          "irritation",
          "wrath",
          "outrage",
          "indignation",
        ],
        fear: [
          "fear",
          "anxiety",
          "terror",
          "panic",
          "dread",
          "fright",
          "apprehension",
        ],
        surprise: [
          "surprise",
          "amazement",
          "astonishment",
          "wonder",
          "shock",
          "bewilderment",
        ],
        disgust: [
          "disgust",
          "revulsion",
          "repulsion",
          "loathing",
          "abhorrence",
          "nausea",
        ],
      },
    };

    const dict = emotionDictionaries[language] || emotionDictionaries.en;
    const words = this.tokenizeText(text);

    words.forEach((word) => {
      Object.keys(emotions).forEach((emotion) => {
        if (dict[emotion] && dict[emotion].includes(word)) {
          emotions[emotion] += 1;
        }
      });
    });

    const emojiEmotions = this.analyzeEmojiEmotions(text);
    Object.keys(emojiEmotions).forEach((emotion) => {
      if (emotions[emotion] !== undefined) {
        emotions[emotion] += emojiEmotions[emotion];
      }
    });

    const maxEmotion = Math.max(...Object.values(emotions));
    if (maxEmotion > 0) {
      Object.keys(emotions).forEach((emotion) => {
        emotions[emotion] = emotions[emotion] / maxEmotion;
      });
    }

    return emotions;
  }

  analyzeEmojiEmotions(text) {
    const emojiEmotions = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
    };

    const emojiMap = {
      joy: [
        "😀",
        "😃",
        "😄",
        "😁",
        "😆",
        "😂",
        "🤣",
        "😊",
        "😇",
        "🙂",
        "😉",
        "😌",
        "😍",
        "🥰",
        "😘",
        "😗",
        "😙",
        "😚",
        "😋",
        "😛",
        "😜",
        "🤪",
        "😝",
        "🤑",
        "🤗",
      ],
      sadness: [
        "😢",
        "😭",
        "😔",
        "😕",
        "🙁",
        "☹️",
        "😣",
        "😖",
        "😫",
        "😩",
        "🥺",
        "😰",
        "😥",
        "😓",
      ],
      anger: ["😠", "😡", "🤬", "😤", "💢", "👿"],
      fear: ["😱", "😨", "😰", "🥶", "🙀"],
      surprise: ["😲", "😮", "🤯", "😯", "😦", "😧", "🤭"],
      disgust: ["🤢", "🤮", "🤧", "😷", "🙄", "😬"],
    };

    const emojis =
      text.match(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
      ) || [];

    emojis.forEach((emoji) => {
      Object.keys(emojiMap).forEach((emotion) => {
        if (emojiMap[emotion].includes(emoji)) {
          emojiEmotions[emotion] += 0.5;
        }
      });
    });

    return emojiEmotions;
  }

  async extractTopics(text) {
    let topics = [];

    try {
      if (this.localModels.compromise) {
        const doc = this.localModels.compromise(text);
        topics = [
          ...doc.topics().out("array"),
          ...doc.people().out("array"),
          ...doc.places().out("array"),
        ];
      }

      if (this.apiProviders.huggingface.enabled) {
        const apiTopics = await this.extractTopicsWithHuggingFace(text);
        if (apiTopics && apiTopics.length > 0) {
          topics = [...topics, ...apiTopics];
        }
      }

      return [...new Set(topics)].slice(0, 5);
    } catch (error) {
      console.warn("Topic extraction failed:", error);
      return this.extractBasicTopics(text);
    }
  }

  async extractTopicsWithHuggingFace(text) {
    try {
      const topicModelUrl =
        "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";

      const candidateLabels = [
        "technology",
        "business",
        "health",
        "sports",
        "politics",
        "entertainment",
        "science",
        "education",
        "travel",
        "food",
        "технологии",
        "бизнес",
        "здоровье",
        "спорт",
        "политика",
        "развлечения",
        "наука",
        "образование",
        "путешествия",
        "еда",
      ];

      const response = await fetch(topicModelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: candidateLabels,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Topic extraction error: ${response.status}`);
      }

      const data = await response.json();

      if (data.labels && data.scores) {
        return data.labels
          .map((label, index) => ({ label, score: data.scores[index] }))
          .filter((item) => item.score > 0.1)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((item) => item.label);
      }

      return [];
    } catch (error) {
      console.warn("Hugging Face topic extraction failed:", error);
      return [];
    }
  }

  extractBasicTopics(text) {
    const topicKeywords = {
      технологии: [
        "компьютер",
        "интернет",
        "программа",
        "сайт",
        "приложение",
        "AI",
        "искусственный интеллект",
      ],
      бизнес: [
        "деньги",
        "работа",
        "компания",
        "продажи",
        "прибыль",
        "инвестиции",
      ],
      здоровье: [
        "здоровье",
        "болезнь",
        "врач",
        "лечение",
        "медицина",
        "больница",
      ],
      образование: [
        "учеба",
        "школа",
        "университет",
        "студент",
        "знания",
        "обучение",
      ],
      спорт: ["спорт", "игра", "команда", "матч", "тренировка", "соревнование"],
    };

    const words = text.toLowerCase().split(/\s+/);
    const topics = [];

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const matches = keywords.filter((keyword) =>
        words.some((word) => word.includes(keyword))
      );
      if (matches.length > 0) {
        topics.push(topic);
      }
    });

    return topics;
  }

  extractKeywords(text, analysis) {
    const keywords = {
      positive: [],
      negative: [],
      neutral: [],
      emotions: [],
    };

    const words = this.tokenizeText(text);
    const language = this.detectLanguage(text);

    const posWords = this.positiveWords[language] || [];
    const negWords = this.negativeWords[language] || [];

    words.forEach((word) => {
      if (posWords.includes(word)) {
        keywords.positive.push(word);
      } else if (negWords.includes(word)) {
        keywords.negative.push(word);
      } else if (word.length > 4) {
        keywords.neutral.push(word);
      }
    });

    if (analysis.emotions) {
      const dominantEmotion = Object.keys(analysis.emotions).reduce((a, b) =>
        analysis.emotions[a] > analysis.emotions[b] ? a : b
      );

      if (analysis.emotions[dominantEmotion] > 0.3) {
        keywords.emotions.push(dominantEmotion);
      }
    }

    Object.keys(keywords).forEach((category) => {
      keywords[category] = keywords[category].slice(0, 5);
    });

    return keywords;
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

  generateSummary(analysis) {
    const { sentiment, score, confidence, emotions } = analysis;

    let summary = "";

    if (sentiment === "positive") {
      summary =
        confidence > 0.7
          ? "Ярко выраженное позитивное настроение"
          : "Позитивное настроение";
    } else if (sentiment === "negative") {
      summary =
        confidence > 0.7
          ? "Ярко выраженное негативное настроение"
          : "Негативное настроение";
    } else {
      summary = "Нейтральное настроение";
    }

    const dominantEmotion = Object.keys(emotions).reduce((a, b) =>
      emotions[a] > emotions[b] ? a : b
    );

    if (emotions[dominantEmotion] > 0.3) {
      const emotionNames = {
        joy: "радость",
        sadness: "грусть",
        anger: "злость",
        fear: "страх",
        surprise: "удивление",
        disgust: "отвращение",
      };

      summary += `. Преобладающая эмоция: ${
        emotionNames[dominantEmotion] || dominantEmotion
      }`;
    }

    return summary;
  }

  initializeDictionaries() {
    this.positiveWords = {
      ru: [
        "хорошо",
        "отлично",
        "прекрасно",
        "замечательно",
        "великолепно",
        "радость",
        "счастье",
        "любовь",
        "удовольствие",
        "восторг",
        "успех",
        "победа",
        "достижение",
        "триумф",
        "удача",
        "красиво",
        "превосходно",
        "идеально",
        "восхитительно",
        "чудесно",
        "надежда",
        "оптимизм",
        "вдохновение",
        "энтузиазм",
        "благодарность",
      ],
      en: [
        "good",
        "great",
        "excellent",
        "wonderful",
        "amazing",
        "joy",
        "happiness",
        "love",
        "pleasure",
        "delight",
        "success",
        "victory",
        "achievement",
        "triumph",
        "luck",
        "beautiful",
        "perfect",
        "fantastic",
        "awesome",
        "brilliant",
        "hope",
        "optimism",
        "inspiration",
        "enthusiasm",
        "gratitude",
      ],
    };

    this.negativeWords = {
      ru: [
        "плохо",
        "ужасно",
        "отвратительно",
        "кошмарно",
        "ненавистно",
        "грусть",
        "печаль",
        "боль",
        "страдание",
        "горе",
        "неудача",
        "поражение",
        "провал",
        "катастрофа",
        "беда",
        "злость",
        "гнев",
        "ярость",
        "раздражение",
        "агрессия",
        "страх",
        "тревога",
        "паника",
        "ужас",
        "отчаяние",
      ],
      en: [
        "bad",
        "terrible",
        "awful",
        "horrible",
        "disgusting",
        "sadness",
        "sorrow",
        "pain",
        "suffering",
        "grief",
        "failure",
        "defeat",
        "disaster",
        "catastrophe",
        "trouble",
        "anger",
        "rage",
        "fury",
        "irritation",
        "aggression",
        "fear",
        "anxiety",
        "panic",
        "terror",
        "despair",
      ],
    };

    this.neutralWords = {
      ru: [
        "обычно",
        "нормально",
        "стандартно",
        "типично",
        "регулярно",
        "информация",
        "данные",
        "факт",
        "результат",
        "процесс",
      ],
      en: [
        "usually",
        "normally",
        "standard",
        "typical",
        "regular",
        "information",
        "data",
        "fact",
        "result",
        "process",
      ],
    };

    this.emojiSentiment = {
      "😀": 0.8,
      "😃": 0.8,
      "😄": 0.9,
      "😁": 0.7,
      "😆": 0.8,
      "😂": 0.9,
      "🤣": 0.9,
      "😊": 0.8,
      "😇": 0.7,
      "🙂": 0.5,
      "😉": 0.6,
      "😌": 0.4,
      "😍": 0.9,
      "🥰": 0.9,
      "😘": 0.8,
      "😗": 0.6,
      "😙": 0.6,
      "😚": 0.7,
      "😋": 0.7,
      "😛": 0.6,
      "😜": 0.7,
      "🤪": 0.6,
      "😝": 0.5,
      "🤑": 0.3,
      "🤗": 0.8,
      "😐": 0.0,
      "😑": -0.1,
      "😶": 0.0,
      "😏": 0.2,
      "😒": -0.4,
      "🙄": -0.3,
      "😬": -0.2,
      "😔": -0.6,
      "😕": -0.5,
      "🙁": -0.6,
      "☹️": -0.7,
      "😣": -0.6,
      "😖": -0.7,
      "😫": -0.8,
      "😩": -0.8,
      "🥺": -0.4,
      "😢": -0.8,
      "😭": -0.9,
      "😤": -0.6,
      "😠": -0.8,
      "😡": -0.9,
      "🤬": -0.9,
      "😱": -0.8,
      "😨": -0.7,
      "😰": -0.7,
      "😥": -0.6,
      "😓": -0.5,
      "❤️": 0.9,
      "💕": 0.8,
      "💖": 0.9,
      "💗": 0.8,
      "💙": 0.7,
      "💚": 0.7,
      "💛": 0.7,
      "🧡": 0.7,
      "💜": 0.7,
      "🖤": -0.2,
      "💔": -0.8,
      "💯": 0.8,
      "👍": 0.7,
      "👎": -0.7,
      "👏": 0.6,
      "🙌": 0.8,
      "👌": 0.6,
      "✨": 0.7,
      "🌟": 0.8,
      "⭐": 0.7,
      "🔥": 0.6,
      "💪": 0.7,
      "🎉": 0.9,
      "🎊": 0.8,
      "🥳": 0.9,
    };
  }

  async testProvider() {
    if (!this.apiProviders.huggingface.enabled) {
      return { success: false, error: "Hugging Face provider disabled" };
    }

    const testText = "I am very happy today! This is wonderful news.";

    try {
      const result = await this.analyzeWithHuggingFace(
        this.apiProviders.huggingface,
        testText
      );

      return {
        success: true,
        provider: "huggingface",
        result: result,
        sentiment: result?.sentiment,
        score: result?.score,
      };
    } catch (error) {
      return {
        success: false,
        provider: "huggingface",
        error: error.message,
      };
    }
  }

  enableProvider(enabled = true) {
    this.apiProviders.huggingface.enabled = enabled;
    this.savePreferences();
  }

  getServicesStatus() {
    return [
      {
        name: "huggingface",
        enabled: this.apiProviders.huggingface.enabled,
        free: true,
        local: false,
        description: "Анализ тональности через Hugging Face (бесплатно)",
      },
      {
        name: "vader",
        enabled: this.apiProviders.vader.enabled,
        free: true,
        local: true,
        description: "VADER анализ тональности (локально)",
      },
    ];
  }

  async compareTexts(texts) {
    const results = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const analysis = await this.process(texts[i]);
        results.push({
          index: i,
          text:
            texts[i].substring(0, 100) + (texts[i].length > 100 ? "..." : ""),
          ...analysis,
        });
      } catch (error) {
        console.warn(`Failed to analyze text ${i}:`, error);
        results.push({
          index: i,
          text: texts[i].substring(0, 100) + "...",
          sentiment: "unknown",
          score: 0,
          confidence: 0,
          error: error.message,
        });
      }
    }

    return {
      texts: results,
      summary: this.generateComparisonSummary(results),
    };
  }

  generateComparisonSummary(results) {
    const sentiments = results
      .map((r) => r.sentiment)
      .filter((s) => s !== "unknown");
    const scores = results.map((r) => r.score).filter((s) => !isNaN(s));

    return {
      totalTexts: results.length,
      averageScore:
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
      sentimentDistribution: {
        positive: sentiments.filter((s) => s === "positive").length,
        negative: sentiments.filter((s) => s === "negative").length,
        neutral: sentiments.filter((s) => s === "neutral").length,
      },
      mostPositive: results.find((r) => r.score === Math.max(...scores)),
      mostNegative: results.find((r) => r.score === Math.min(...scores)),
    };
  }

  savePreferences() {
    const prefs = {
      enabled: this.isEnabled,
      language: this.language,
      providers: {
        huggingface: {
          enabled: this.apiProviders.huggingface.enabled,
        },
        vader: {
          enabled: this.apiProviders.vader.enabled,
        },
      },
    };

    try {
      localStorage.setItem("writerquest-sentiment", JSON.stringify(prefs));
    } catch (error) {
      console.warn("Could not save sentiment analysis preferences:", error);
    }
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem("writerquest-sentiment");
      if (saved) {
        const prefs = JSON.parse(saved);
        this.isEnabled = prefs.enabled !== undefined ? prefs.enabled : true;
        this.language = prefs.language || "auto";

        if (prefs.providers) {
          if (prefs.providers.huggingface) {
            this.apiProviders.huggingface.enabled =
              prefs.providers.huggingface.enabled;
          }
          if (prefs.providers.vader) {
            this.apiProviders.vader.enabled = prefs.providers.vader.enabled;
          }
        }
      }
    } catch (error) {
      console.warn("Could not load sentiment analysis preferences:", error);
    }
  }

  setLanguage(language) {
    if (["auto", "ru", "en"].includes(language)) {
      this.language = language;
    }
  }

  getLanguage() {
    return this.language;
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  isAnalysisEnabled() {
    return this.isEnabled;
  }

  // Экспорт детального отчета
  async generateDetailedReport(text) {
    const analysis = await this.process(text);

    return {
      timestamp: new Date().toISOString(),
      text: {
        preview: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
        length: text.length,
        wordCount: text.split(/\s+/).length,
        language: analysis.language,
      },
      sentiment: {
        overall: analysis.sentiment,
        score: analysis.score,
        confidence: analysis.confidence,
      },
      emotions: analysis.emotions,
      topics: analysis.topics,
      keywords: analysis.keywords,
      provider: analysis.details?.provider || "local",
      summary: analysis.summary,
      recommendations: this.generateRecommendations(analysis),
    };
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.sentiment === "negative" && analysis.confidence > 0.7) {
      recommendations.push(
        "Текст имеет ярко выраженную негативную окраску. Рассмотрите возможность смягчения тона."
      );
    }

    if (analysis.emotions.anger > 0.5) {
      recommendations.push(
        "В тексте преобладает гнев. Возможно, стоит пересмотреть эмоциональную подачу."
      );
    }

    if (analysis.emotions.joy > 0.7) {
      recommendations.push(
        "Отличный позитивный настрой! Текст вызывает положительные эмоции."
      );
    }

    if (analysis.confidence < 0.3) {
      recommendations.push(
        "Анализ показал низкую уверенность. Возможно, текст содержит смешанные эмоции."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Текст имеет сбалансированную эмоциональную окраску."
      );
    }

    return recommendations;
  }
}
