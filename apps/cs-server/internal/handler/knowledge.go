package handler

import (
	"net/http"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/agent-mono/cs-server/internal/service/knowledge"
	"github.com/gin-gonic/gin"
)

type KnowledgeHandler struct {
	store *knowledge.Store
}

func NewKnowledgeHandler(store *knowledge.Store) *KnowledgeHandler {
	return &KnowledgeHandler{store: store}
}

func (h *KnowledgeHandler) List(c *gin.Context) {
	docs := h.store.ListDocs()
	c.JSON(http.StatusOK, gin.H{"docs": docs})
}

func (h *KnowledgeHandler) Get(c *gin.Context) {
	id := c.Param("id")
	doc := h.store.GetDoc(id)
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"doc": doc})
}

func (h *KnowledgeHandler) Create(c *gin.Context) {
	var doc model.KnowledgeDoc
	if err := c.ShouldBindJSON(&doc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.store.AddDocument(c.Request.Context(), doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "created"})
}

func (h *KnowledgeHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	h.store.DeleteDoc(id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *KnowledgeHandler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	results, err := h.store.Search(c.Request.Context(), query, 5)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
