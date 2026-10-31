import pytest
from httpx import AsyncClient

# Valid mock WebM header (EBML \x1a\x45\xdf\xa3 + padding)
MOCK_WEBM_BYTES = b"\x1a\x45\xdf\xa3" + b"\x00" * 64


@pytest.mark.asyncio
async def test_session_lifecycle_and_turn(async_client: AsyncClient):
    # 1. Create a debate session
    session_payload = {
        "topic": "Universal Basic Income reduces systemic poverty",
        "difficulty": "intermediate",
        "initial_thesis": "Cash transfers provide immediate financial liquidity without bureaucratic overhead.",
    }
    create_res = await async_client.post("/api/sessions", json=session_payload)
    assert create_res.status_code == 201
    session_data = create_res.json()
    session_id = session_data["id"]
    assert session_data["topic"] == session_payload["topic"]
    assert session_data["status"] == "active"

    # 2. Submit Turn 1
    files = {"audio": ("turn1.webm", MOCK_WEBM_BYTES, "audio/webm")}
    data = {"duration_ms": 12000}
    turn_res = await async_client.post(
        f"/api/sessions/{session_id}/turn", files=files, data=data
    )
    assert turn_res.status_code == 200
    turn_data = turn_res.json()
    assert turn_data["turn_number"] == 1
    assert turn_data["speech_detected"] is True
    assert turn_data["delivery"]["confidence_score"] == 78
    assert turn_data["session_overall_score"] is not None

    # 3. Retrieve Session Details and Trend
    get_res = await async_client.get(f"/api/sessions/{session_id}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["id"] == session_id
    assert len(detail["turns"]) == 2  # 1 user row + 1 assistant row
    assert len(detail["trend"]) == 1  # 1 trend point for user turn 1
    assert detail["trend"][0]["turn_number"] == 1
    assert detail["trend"][0]["confidence"] == 78

    # 4. Mark session complete
    comp_res = await async_client.patch(f"/api/sessions/{session_id}/complete")
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_session_user_side_set_at_creation_and_not_inferred_from_thesis(
    async_client: AsyncClient,
):
    """Verifies that user_side is explicitly stored and backfilled, defaulting to government."""
    # Default side is government
    res_gov = await async_client.post(
        "/api/sessions",
        json={"topic": "Resolved: Artificial intelligence should be regulated"},
    )
    assert res_gov.status_code == 201
    gov_data = res_gov.json()
    assert gov_data["user_side"] == "government"

    # Explicit opposition side
    res_opp = await async_client.post(
        "/api/sessions",
        json={
            "topic": "Resolved: Space exploration deserves state funding",
            "user_side": "opposition",
        },
    )
    assert res_opp.status_code == 201
    opp_data = res_opp.json()
    assert opp_data["user_side"] == "opposition"


@pytest.mark.asyncio
async def test_thesis_containing_opposition_does_not_change_side(
    async_client: AsyncClient,
):
    """
    Verifies requirement 3: A thesis containing the word 'opposition' does NOT
    change user_side if the user chose government. Side is strictly from user_side column.
    """
    payload = {
        "topic": "Resolved: Nuclear energy is essential for climate targets",
        "user_side": "government",
        "initial_thesis": "I stand in opposition to fossil fuel lobbies, and the opposition party has failed to address this.",
    }
    create_res = await async_client.post("/api/sessions", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["user_side"] == "government"

    session_id = data["id"]
    get_res = await async_client.get(f"/api/sessions/{session_id}")
    assert get_res.status_code == 200
    assert get_res.json()["user_side"] == "government"

