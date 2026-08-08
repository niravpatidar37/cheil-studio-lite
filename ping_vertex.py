import asyncio
import time
from dotenv import load_dotenv

load_dotenv()

async def run():
    import backend.gemini.generation as gen
    ideas = [{"id": 1, "en": "hello", "headline_en": "test", "body_en": "foo"}]
    start = time.time()
    try:
        await gen.translate_ideas(ideas)
        end = time.time()
        with open("ping_result.txt", "w") as f:
            f.write(str(end - start))
    except Exception as e:
        with open("ping_result.txt", "w") as f:
            f.write("ERROR " + str(e))

asyncio.run(run())
