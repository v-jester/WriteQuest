class AIConfigManager {
  constructor() {
    this.config = {
      enabled: true,
      fallbackToLocal: true,
      rateLimiting: true,
      cacheResults: true,

      limits: {
        requestsPerMinute: 20,
        requestsPerHour: 200,
        requestsPerDay: 1000,
      },

      providers: {
        autocomplete: {
          primary: "huggingface",
          fallback: ["local"],
          enabled: true,
        },

        textImprovement: {
          primary: "languagetool",
          fallback: ["yandex", "huggingface", "local"],
          enabled: true,
        },

        sentiment: {
          primary: "huggingface",
          fallback: ["vader", "local"],
          enabled: true,
        },
      },

      cache: {
        ttl: 3600000,
        maxSize: 50,
      },
    };

    this.usage = {
      daily: {},
      hourly: {},
    };

    this.freeServices = {
      huggingface: {
        name: "Hugging Face",
        description: "AI модели для автодополнения и анализа тональности",
        endpoint: "https://api-inference.huggingface.co/models/",
        rateLimit: "Без ограничений, возможны задержки при высокой нагрузке",
        requiresKey: false,
      },
      languagetool: {
        name: "LanguageTool",
        description: "Проверка грамматики и стиля",
        endpoint: "https://api.languagetool.org/v2/check",
        rateLimit: "20 запросов в минуту",
        requiresKey: false,
      },
      yandex: {
        name: "Yandex Speller",
        description: "Проверка орфографии русского языка",
        endpoint:
          "https://speller.yandex.net/services/spellservice.json/checkText",
        rateLimit: "Без ограничений",
        requiresKey: false,
      },
      vader: {
        name: "VADER Sentiment",
        description: "Локальный анализ тональности",
        endpoint: "local",
        rateLimit: "Без ограничений",
        requiresKey: false,
      },
    };

    this.loadConfiguration();
  }

  async setupProvider(service, provider, config = {}) {
    if (!this.config.providers[service]) {
      throw new Error(`Unknown service: ${service}`);
    }

    if (!this.freeServices[provider]) {
      throw new Error(
        `Provider ${provider} is not supported (only free services allowed)`
      );
    }

    const isValid = await this.validateProviderConfig(provider, config);
    if (!isValid.valid) {
      throw new Error(`Invalid configuration: ${isValid.error}`);
    }

    this.config.providers[service][provider] = config;

    const testResult = await this.testProviderConnection(service, provider);

    this.saveConfiguration();

    return {
      success: true,
      provider,
      service,
      testResult,
    };
  }

  async validateProviderConfig(provider, config) {
    const service = this.freeServices[provider];
    if (!service) {
      return { valid: false, error: `Unknown provider: ${provider}` };
    }

    if (provider !== "vader") {
      const isAvailable = await this.isProviderAvailable(provider);
      if (!isAvailable) {
        return { valid: false, error: `Provider ${provider} is not available` };
      }
    }

    return { valid: true };
  }

  async testProviderConnection(service, provider) {
    const services = {
      autocomplete: window.app?.editor?.autoComplete,
      textImprovement: window.app?.editor?.textImprover,
      sentiment: window.app?.editor?.sentimentAnalysis,
    };

    const serviceInstance = services[service];
    if (!serviceInstance || !serviceInstance.testProvider) {
      return { success: false, error: "Service not available" };
    }

    try {
      const result = await serviceInstance.testProvider(provider);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  checkRateLimit(provider, service) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.toDateString();
    const minute = `${day}-${hour}-${now.getMinutes()}`;

    if (!this.usage.daily[day]) this.usage.daily[day] = {};
    if (!this.usage.hourly[hour]) this.usage.hourly[hour] = {};
    if (!this.usage.daily[day][provider]) this.usage.daily[day][provider] = 0;
    if (!this.usage.hourly[hour][provider])
      this.usage.hourly[hour][provider] = 0;

    const dailyUsage = this.usage.daily[day][provider];
    const hourlyUsage = this.usage.hourly[hour][provider];

    const serviceLimits = {
      languagetool: { perMinute: 20, perHour: 200, perDay: 1000 },
      huggingface: { perMinute: 10, perHour: 100, perDay: 500 },
      yandex: { perMinute: 60, perHour: 1000, perDay: 5000 },
      vader: { perMinute: 1000, perHour: 10000, perDay: 50000 },
    };

    const limits = serviceLimits[provider] || this.config.limits;

    if (dailyUsage >= limits.perDay) {
      return {
        allowed: false,
        reason: "Daily limit exceeded",
        resetTime: "midnight",
      };
    }

    if (hourlyUsage >= limits.perHour) {
      return {
        allowed: false,
        reason: "Hourly limit exceeded",
        resetTime: "next hour",
      };
    }

    return { allowed: true };
  }

  recordUsage(provider, service) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.toDateString();

    if (!this.usage.daily[day]) this.usage.daily[day] = {};
    if (!this.usage.hourly[hour]) this.usage.hourly[hour] = {};

    this.usage.daily[day][provider] =
      (this.usage.daily[day][provider] || 0) + 1;
    this.usage.hourly[hour][provider] =
      (this.usage.hourly[hour][provider] || 0) + 1;

    this.cleanupUsageData();
  }

  cleanupUsageData() {
    const now = new Date();
    const currentDay = now.toDateString();
    const currentHour = now.getHours();

    Object.keys(this.usage.daily).forEach((day) => {
      const dayDate = new Date(day);
      const daysDiff = (now - dayDate) / (1000 * 60 * 60 * 24);
      if (daysDiff > 3) {
        delete this.usage.daily[day];
      }
    });

    Object.keys(this.usage.hourly).forEach((hour) => {
      if (Math.abs(currentHour - parseInt(hour)) > 12) {
        delete this.usage.hourly[hour];
      }
    });
  }

  async selectBestProvider(service, text = "") {
    const serviceConfig = this.config.providers[service];
    if (!serviceConfig || !serviceConfig.enabled) {
      return null;
    }

    const providers = [
      serviceConfig.primary,
      ...(serviceConfig.fallback || []),
    ];

    for (const provider of providers) {
      if (!this.freeServices[provider] && provider !== "local") {
        continue;
      }

      const rateLimit = this.checkRateLimit(provider, service);
      if (!rateLimit.allowed) {
        console.warn(
          `Rate limit exceeded for ${provider}: ${rateLimit.reason}`
        );
        continue;
      }

      const isAvailable = await this.isProviderAvailable(provider);
      if (!isAvailable) {
        console.warn(`Provider ${provider} is not available`);
        continue;
      }

      const suitability = this.calculateProviderSuitability(
        provider,
        service,
        text
      );
      if (suitability < 0.5) {
        continue;
      }

      return provider;
    }

    return this.config.fallbackToLocal ? "local" : null;
  }

  async isProviderAvailable(provider) {
    if (provider === "local" || provider === "vader") {
      return true;
    }

    try {
      const service = this.freeServices[provider];
      if (!service) return false;

      const response = await fetch(service.endpoint, {
        method: "HEAD",
        timeout: 3000,
      });

      return response.status < 500;
    } catch (error) {
      return false;
    }
  }

  calculateProviderSuitability(provider, service, text) {
    let score = 1.0;

    const preferences = {
      autocomplete: {
        huggingface: 0.9,
        local: 0.6,
      },
      textImprovement: {
        languagetool: 0.95,
        yandex: 0.8,
        huggingface: 0.7,
        local: 0.5,
      },
      sentiment: {
        huggingface: 0.9,
        vader: 0.8,
        local: 0.6,
      },
    };

    score *= preferences[service]?.[provider] || 0.7;

    const language = this.detectLanguage(text);
    if (language === "ru") {
      const ruBonus = {
        yandex: 0.3,
        vader: 0.1,
        local: 0.1,
      };
      score += ruBonus[provider] || 0;
    }

    if (text.length > 3000) {
      const longTextBonus = {
        local: 0.2,
        vader: 0.1,
      };
      score += longTextBonus[provider] || -0.1;
    }

    return Math.max(0, Math.min(1, score));
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

  getUsageStatistics() {
    const stats = {
      today: {},
      thisWeek: {},
      allTime: {},
    };

    const now = new Date();
    const today = now.toDateString();
    const thisWeek = this.getWeekKey(now);

    stats.today = this.usage.daily[today] || {};

    Object.entries(this.usage.daily).forEach(([day, dayUsage]) => {
      const dayDate = new Date(day);
      if (this.getWeekKey(dayDate) === thisWeek) {
        Object.entries(dayUsage).forEach(([provider, count]) => {
          stats.thisWeek[provider] = (stats.thisWeek[provider] || 0) + count;
        });
      }
    });

    Object.values(this.usage.daily).forEach((dayUsage) => {
      Object.entries(dayUsage).forEach(([provider, count]) => {
        stats.allTime[provider] = (stats.allTime[provider] || 0) + count;
      });
    });

    return stats;
  }

  getWeekKey(date) {
    const week = Math.floor(
      (date - new Date(date.getFullYear(), 0, 1)) / 604800000
    );
    return `${date.getFullYear()}-W${week}`;
  }

  getServiceInfo(provider) {
    return this.freeServices[provider] || null;
  }

  getAllServicesInfo() {
    return { ...this.freeServices };
  }

  updateSettings(newSettings) {
    const allowedSettings = {
      enabled: newSettings.enabled,
      fallbackToLocal: newSettings.fallbackToLocal,
      rateLimiting: newSettings.rateLimiting,
      cacheResults: newSettings.cacheResults,
    };

    this.config = { ...this.config, ...allowedSettings };
    this.saveConfiguration();
  }

  getSettings() {
    return { ...this.config };
  }

  resetToDefaults() {
    const backup = { ...this.config };

    this.config = {
      enabled: true,
      fallbackToLocal: true,
      rateLimiting: true,
      cacheResults: true,
      limits: {
        requestsPerMinute: 20,
        requestsPerHour: 200,
        requestsPerDay: 1000,
      },
      providers: {
        autocomplete: {
          primary: "huggingface",
          fallback: ["local"],
          enabled: true,
        },
        textImprovement: {
          primary: "languagetool",
          fallback: ["yandex", "local"],
          enabled: true,
        },
        sentiment: {
          primary: "huggingface",
          fallback: ["vader", "local"],
          enabled: true,
        },
      },
      cache: {
        ttl: 3600000,
        maxSize: 50,
      },
    };

    this.saveConfiguration();
    return backup;
  }

  exportConfiguration() {
    return {
      version: "1.0-free",
      timestamp: new Date().toISOString(),
      config: this.config,
      usage: this.getUsageStatistics(),
      services: this.freeServices,
    };
  }

  async importConfiguration(configData) {
    if (!configData.version || !configData.config) {
      throw new Error("Invalid configuration format");
    }

    if (!configData.version.includes("free")) {
      throw new Error(
        "This configuration contains paid services which are not supported"
      );
    }

    const validation = await this.validateConfiguration(configData.config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.error}`);
    }

    const backup = this.exportConfiguration();

    try {
      this.config = { ...configData.config };
      this.saveConfiguration();

      return { success: true, backup };
    } catch (error) {
      this.config = backup.config;
      this.saveConfiguration();
      throw error;
    }
  }

  async validateConfiguration(config) {
    const requiredFields = ["enabled", "providers", "limits"];
    for (const field of requiredFields) {
      if (!config.hasOwnProperty(field)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    const requiredServices = ["autocomplete", "textImprovement", "sentiment"];
    for (const service of requiredServices) {
      if (!config.providers[service]) {
        return {
          valid: false,
          error: `Missing service configuration: ${service}`,
        };
      }
    }

    return { valid: true };
  }

  saveConfiguration() {
    try {
      const configToSave = {
        config: this.config,
        usage: this.usage,
        savedAt: new Date().toISOString(),
        version: "1.0-free",
      };

      localStorage.setItem(
        "writerquest-ai-config-free",
        JSON.stringify(configToSave)
      );
    } catch (error) {
      console.warn("Could not save AI configuration:", error);
    }
  }

  loadConfiguration() {
    try {
      const saved = localStorage.getItem("writerquest-ai-config-free");
      if (saved) {
        const data = JSON.parse(saved);

        if (data.config) {
          this.config = { ...this.config, ...data.config };
        }

        if (data.usage) {
          this.usage = data.usage;
        }
      }
    } catch (error) {
      console.warn("Could not load AI configuration:", error);
    }
  }

  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      overall: "unknown",
      services: {},
      providers: {},
      network: {},
      configuration: {},
    };

    try {
      results.configuration = await this.validateConfiguration(this.config);

      const providers = Object.keys(this.freeServices);
      for (const provider of providers) {
        results.providers[provider] = {
          available: await this.isProviderAvailable(provider),
          configured: true,
          rateLimit: this.checkRateLimit(provider, "test"),
          info: this.freeServices[provider],
        };
      }

      results.network = await this.checkNetworkConnectivity();

      const allProvidersDown = Object.values(results.providers)
        .filter((p) => p.info.endpoint !== "local")
        .every((p) => !p.available);

      if (!results.configuration.valid) {
        results.overall = "error";
      } else if (allProvidersDown) {
        results.overall = "warning";
      } else {
        results.overall = "ok";
      }
    } catch (error) {
      results.overall = "error";
      results.error = error.message;
    }

    return results;
  }

  async checkNetworkConnectivity() {
    const testUrls = [
      "https://api-inference.huggingface.co",
      "https://api.languagetool.org",
      "https://speller.yandex.net",
    ];

    const results = {};

    for (const url of testUrls) {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          timeout: 5000,
        });
        results[url] = {
          reachable: true,
          status: response.status,
          latency: performance.now(),
        };
      } catch (error) {
        results[url] = {
          reachable: false,
          error: error.message,
        };
      }
    }

    return results;
  }

  async optimizeConfiguration() {
    const diagnostics = await this.runDiagnostics();
    const recommendations = [];

    Object.entries(diagnostics.providers).forEach(([provider, status]) => {
      if (!status.available && provider !== "vader") {
        recommendations.push({
          type: "warning",
          message: `Provider ${provider} is not available`,
          action: "switch_to_fallback",
          details: { provider },
        });
      }
    });

    const usage = this.getUsageStatistics();
    Object.entries(usage.today).forEach(([provider, requests]) => {
      const serviceInfo = this.freeServices[provider];
      if (serviceInfo && requests > 50) {
        recommendations.push({
          type: "info",
          message: `High usage for ${provider}: ${requests} requests today`,
          action: "consider_caching",
          details: { provider, requests },
        });
      }
    });

    return {
      diagnostics,
      recommendations,
      optimized: recommendations.length === 0,
    };
  }

  getHelpInfo() {
    return {
      title: "Бесплатные AI сервисы WriterQuest",
      description: "Все сервисы полностью бесплатны и не требуют регистрации",
      services: Object.entries(this.freeServices).map(([key, service]) => ({
        id: key,
        name: service.name,
        description: service.description,
        rateLimit: service.rateLimit,
        endpoint: service.endpoint !== "local" ? "Внешний API" : "Локально",
      })),
      tips: [
        "Hugging Face может иметь задержки при высокой нагрузке",
        "LanguageTool ограничен 20 запросами в минуту",
        "Yandex Speller работает только с русским языком",
        "VADER анализ работает локально без ограничений",
        "При недоступности внешних API автоматически используются локальные методы",
      ],
    };
  }
}

window.aiConfigManager = new AIConfigManager();

if (typeof module !== "undefined" && module.exports) {
  module.exports = AIConfigManager;
}
