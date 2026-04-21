package config

import "os"

type Config struct {
	Port          string
	OpenAIKey     string
	OpenAIBaseURL string
	OpenAIModel   string
}

func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "3400"),
		OpenAIKey:     getEnv("OPENAI_API_KEY", ""),
		OpenAIBaseURL: getEnv("OPENAI_BASE_URL", "https://api.deepseek.com/v1"),
		OpenAIModel:   getEnv("OPENAI_MODEL", "deepseek-chat"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
