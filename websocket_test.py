import asyncio, json, websockets
import numpy as np

async def handler(ws):
    async for msg in ws:
        data = json.loads(msg)
        print(data)
        # hand = data["hand"]
        # pos = np.array(data["pos"])
        # rot = np.array(data["rot"])
        # gripPressed = data["gripPressed"]
        # print(f"{hand}: pos={pos}, rot={rot}, gripPressed={gripPressed}")
        # TODO: map to robot command
        # lerobot.move_ee(hand, pos, rot)

async def main():
    print("🌐 WebSocket server listening on ws://0.0.0.0:8080")
    async with websockets.serve(handler, "0.0.0.0", 8080):
        await asyncio.Future()

asyncio.run(main())




# import asyncio, websockets, json

# async def handler(ws):
#     async for msg in ws:
#         print("✅ Received:", msg)
#         await ws.send(json.dumps({"reply": "Hello from server!"}))

# async def main():
#     print("🌐 WebSocket server listening on ws://0.0.0.0:8080")
#     async with websockets.serve(handler, "0.0.0.0", 8080):
#         await asyncio.Future()

# asyncio.run(main())
