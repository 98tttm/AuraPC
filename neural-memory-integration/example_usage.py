import asyncio
from memory_manager import memory_manager

async def main():
    print("--- Initializing NeuralMemory for AuraPC ---")
    await memory_manager.initialize()

    # 1. Store some memories
    print("\n[Step 1] Storing memories...")
    memories = [
        "AuraPC is an AI-powered project management system.",
        "The project uses Angular for the frontend and Python for the backend.",
        "Alice is the lead developer of the AuraPC project.",
        "We decided to use SQLite for local neural memory storage.",
        "The team prefers using SDD (Spec-Driven Development) for all features."
    ]
    
    for msg in memories:
        print(f"  > Remembering: {msg}")
        await memory_manager.remember(msg)

    # 2. Recall memories
    print("\n[Step 2] Recalling memories...")
    queries = [
        "What is AuraPC?",
        "Who is the lead developer?",
        "What tech stack are we using?",
        "What is our development methodology?"
    ]

    for q in queries:
        context = await memory_manager.recall(q)
        print(f"\nQuery: {q}")
        print(f"Result: {context if context else 'No relevant memory found.'}")

if __name__ == "__main__":
    asyncio.run(main())
