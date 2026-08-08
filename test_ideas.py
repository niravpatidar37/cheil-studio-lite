import asyncio
from backend.main import api_generate_ideas, IdeaGenRequest, app

async def test():
    req = IdeaGenRequest(
        brief="Test",
        product="Prod",
        products=["Prod"],
        background="Bg",
        formats=["Mobile"],
        audiences=["Aud"]
    )
    try:
        await api_generate_ideas(req)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
