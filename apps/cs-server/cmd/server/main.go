package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/agent-mono/cs-server/internal/config"
	"github.com/agent-mono/cs-server/internal/handler"
	"github.com/agent-mono/cs-server/internal/middleware"
	"github.com/agent-mono/cs-server/internal/model"
	"github.com/agent-mono/cs-server/internal/service/chat"
	"github.com/agent-mono/cs-server/internal/service/intent"
	"github.com/agent-mono/cs-server/internal/service/knowledge"
	"github.com/agent-mono/cs-server/internal/service/rag"
	"github.com/agent-mono/cs-server/internal/ws"
	"github.com/agent-mono/cs-server/pkg/llm"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	llmClient := llm.NewClient(cfg.OpenAIKey, cfg.OpenAIBaseURL, cfg.OpenAIModel)

	knowledgeStore := knowledge.NewStore(llmClient)
	seedKnowledgeBase(knowledgeStore)

	sessionMgr := chat.NewSessionManager()
	intentRecognizer := intent.NewRecognizer(llmClient)
	ragService := rag.NewService(llmClient, knowledgeStore)

	hub := ws.NewHub()
	hub.OnMessage = func(client *ws.Client, msg *model.WSMessage) {
		switch msg.Type {
		case "agent_message":
			sessionMgr.AddMessage(msg.SessionID, model.Message{
				Role:    model.RoleAssistant,
				Content: msg.Content,
			})
			hub.SendToSession(msg.SessionID, &model.WSMessage{
				Type:      "agent_message",
				SessionID: msg.SessionID,
				Content:   msg.Content,
				From:      "agent",
			})
		case "agent_join":
			sessionMgr.SetAgent(msg.SessionID, client.ID)
			hub.SendToSession(msg.SessionID, &model.WSMessage{
				Type:      "agent_joined",
				SessionID: msg.SessionID,
				Content:   "人工客服已接入",
			})
		}
	}
	go hub.Run()

	chatHandler := handler.NewChatHandler(sessionMgr, ragService, intentRecognizer, hub)
	knowledgeHandler := handler.NewKnowledgeHandler(knowledgeStore)
	wsHandler := handler.NewWSHandler(hub)
	intentHandler := handler.NewIntentHandler(intentRecognizer)

	r := gin.New()
	r.Use(middleware.Logger())
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "cs-server"})
	})

	api := r.Group("/api/cs")
	{
		api.POST("/chat", chatHandler.Chat)
		api.POST("/chat/stream", chatHandler.ChatStream)

		api.POST("/sessions", chatHandler.CreateSession)
		api.GET("/sessions", chatHandler.ListSessions)
		api.GET("/sessions/:id", chatHandler.GetSession)
		api.POST("/sessions/:id/transfer/human", chatHandler.TransferToHuman)
		api.POST("/sessions/:id/transfer/ai", chatHandler.TransferToAI)

		api.GET("/knowledge", knowledgeHandler.List)
		api.GET("/knowledge/:id", knowledgeHandler.Get)
		api.POST("/knowledge", knowledgeHandler.Create)
		api.DELETE("/knowledge/:id", knowledgeHandler.Delete)
		api.GET("/knowledge/search", knowledgeHandler.Search)

		api.GET("/intents", intentHandler.ListIntents)
		api.POST("/intents/recognize", intentHandler.Recognize)
	}

	r.GET("/ws/customer", wsHandler.CustomerWS)
	r.GET("/ws/agent", wsHandler.AgentWS)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		log.Printf("CS Server starting on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Server exited")
}

func seedKnowledgeBase(store *knowledge.Store) {
	data, err := os.ReadFile("knowledge_base/seed.json")
	if err != nil {
		log.Printf("No seed data found: %v", err)
		return
	}

	var docs []model.KnowledgeDoc
	if err := json.Unmarshal(data, &docs); err != nil {
		log.Printf("Failed to parse seed data: %v", err)
		return
	}

	ctx := context.Background()
	for _, doc := range docs {
		if err := store.AddDocument(ctx, doc); err != nil {
			log.Printf("Failed to seed doc %s: %v", doc.ID, err)
		}
	}
	log.Printf("Seeded %d knowledge documents", len(docs))
}
