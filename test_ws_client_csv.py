import asyncio
import websockets
import json

async def test_sim():
    uri = "ws://localhost:8000/ws/simulation"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as ws:
            status = await ws.recv()
            print("Initial Status:", json.loads(status))
            
            print("Sending START command...")
            await ws.send(json.dumps({"type": "START"}))
            
            for i in range(5):
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("type") == "simulation_update":
                    print(f"Tick {i+1}: Lap {data['lap']}, Time: {data['time']:.1f}s, Speed: {data['ml_car']['speed']:.1f} km/h")
                else:
                    print(f"Received: {data}")
            
            print("Sending STOP command...")
            await ws.send(json.dumps({"type": "STOP"}))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_sim())
