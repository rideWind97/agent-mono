package handler

import (
	"net/http"

	"github.com/agent-mono/cs-server/internal/service/intent"
	"github.com/gin-gonic/gin"
)

type IntentHandler struct {
	recognizer *intent.Recognizer
}

func NewIntentHandler(recognizer *intent.Recognizer) *IntentHandler {
	return &IntentHandler{recognizer: recognizer}
}

func (h *IntentHandler) ListIntents(c *gin.Context) {
	intents := h.recognizer.GetIntents()
	c.JSON(http.StatusOK, gin.H{"intents": intents})
}

func (h *IntentHandler) Recognize(c *gin.Context) {
	var req struct {
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.recognizer.Recognize(c.Request.Context(), req.Message, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"intent": result})
}
