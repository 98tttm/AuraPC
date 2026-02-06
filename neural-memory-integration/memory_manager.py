import asyncio
import os
from typing import List, Optional
from neural_memory import Brain
from neural_memory.storage import SQLiteStorage
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.engine.retrieval import ReflexPipeline

class NeuralMemoryManager:
    """
    Manager class for NeuralMemory integration.
    Handles storage, encoding, and retrieval of memories.
    """
    def __init__(self, brain_name: str = "aurapc_project", db_path: str = "neural_memory.db"):
        self.brain_name = brain_name
        self.db_path = db_path
        self.storage = SQLiteStorage(db_path)
        self.brain = None
        self.encoder = None
        self.pipeline = None

    async def initialize(self):
        """Initialize the brain and engines."""
        # Initialize storage first
        await self.storage.initialize()
        
        # Try to find existing brain by name
        # Note: find_brain_by_name might return a Brain object or an ID string
        result = await self.storage.find_brain_by_name(self.brain_name)
        
        if result:
            if hasattr(result, 'id'):
                self.brain = result
            else:
                self.brain = await self.storage.get_brain(result)
        else:
            self.brain = Brain.create(self.brain_name)
            await self.storage.save_brain(self.brain)
        
        self.storage.set_brain(self.brain.id)
        self.encoder = MemoryEncoder(self.storage, self.brain.config)
        self.pipeline = ReflexPipeline(self.storage, self.brain.config)

    async def remember(self, text: str, memory_type: str = "fact"):
        """Store a new memory."""
        if not self.encoder:
            await self.initialize()
        # Use tags or metadata for memory_type since encode() doesn't take 'type'
        await self.encoder.encode(text, tags={memory_type})

    async def recall(self, query: str, limit: int = 5) -> str:
        """Recall memories based on a query."""
        if not self.pipeline:
            await self.initialize()
        result = await self.pipeline.query(query)
        return result.context

    async def get_all_memories(self):
        """Retrieve all stored neurons (memories)."""
        if not self.storage:
            await self.initialize()
        return await self.storage.get_neurons(self.brain.id)

# Singleton instance for easy access
memory_manager = NeuralMemoryManager()
