"""
Test script to verify MongoDB client is a singleton.
Run this to prove only ONE client instance is created.

Usage:
    python test_singleton.py
"""
import asyncio
from db import get_client, ensure_indexes


async def test_singleton():
    """Test that get_client() always returns the same instance."""
    print("=" * 60)
    print("Testing MongoDB Client Singleton Pattern")
    print("=" * 60)
    print()
    
    # Call get_client() multiple times
    print("1. Calling get_client() first time...")
    client1 = get_client()
    print(f"   → Client ID: {id(client1)}")
    print()
    
    print("2. Calling get_client() second time...")
    client2 = get_client()
    print(f"   → Client ID: {id(client2)}")
    print()
    
    print("3. Calling get_client() third time...")
    client3 = get_client()
    print(f"   → Client ID: {id(client3)}")
    print()
    
    # Check if they're the same instance
    print("-" * 60)
    print("VERIFICATION:")
    print(f"client1 is client2: {client1 is client2}")
    print(f"client2 is client3: {client2 is client3}")
    print(f"client1 is client3: {client1 is client3}")
    print()
    
    if client1 is client2 is client3:
        print("✅ SUCCESS: All clients are THE SAME INSTANCE!")
        print("   Only ONE MongoDB client exists in memory.")
    else:
        print("❌ FAIL: Multiple instances detected!")
    
    print()
    print("=" * 60)
    print("Test Complete")
    print("=" * 60)
    print()
    
    # Test ensure_indexes (should use same client)
    print("4. Testing ensure_indexes() uses same client...")
    await ensure_indexes()
    client4 = get_client()
    print(f"   → Client ID after ensure_indexes: {id(client4)}")
    print(f"   → Still same instance: {client1 is client4}")
    print()


if __name__ == "__main__":
    print()
    print("This test proves that only ONE MongoDB client is created,")
    print("no matter how many times get_client() is called.")
    print()
    
    asyncio.run(test_singleton())
    
    print()
    print("You should have seen the message:")
    print('  "[DB] MongoDB client created successfully (this should only happen ONCE)"')
    print()
    print("If you saw it only ONCE, the singleton pattern is working! ✅")
    print()

