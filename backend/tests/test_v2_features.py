# File: backend/tests/test_v2_features.py
"""
Comprehensive tests for v2 improvements.
"""

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.integrations.ws_manager import NotificationManager
from app.main import app
from app.models.escrow import (
    DisputeEvidence,
    DisputeEvidenceType,
    EscrowStatus,
    EscrowTransaction,
    WithdrawalRequest,
    WithdrawalStatus,
)
from app.models.schedule import ArtisanSchedule, BlockedDate
from app.models.user import User
from app.services.escrow_service import create_escrow_hold, release_escrow
from app.utils.rwanda_address import (
    format_address,
    get_cells,
    get_districts,
    get_provinces,
    get_sectors,
)

client = TestClient(app)


# ── Health & Root ─────────────────────────────────────────────────────────────


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.1.0"
    assert "ws_users" in data


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert "2.1" in r.json()["message"]


# ── Address Endpoints ─────────────────────────────────────────────────────────


def test_list_provinces():
    r = client.get("/address/provinces")
    assert r.status_code == 200
    provinces = r.json()["provinces"]
    assert len(provinces) >= 5
    for name in [
        "Kigali City",
        "Eastern Province",
        "Northern Province",
        "Southern Province",
        "Western Province",
    ]:
        assert name in provinces


def test_list_districts():
    r = client.get("/address/districts")
    assert r.status_code == 200
    districts = r.json()["districts"]
    assert "Gasabo" in districts
    assert "Kicukiro" in districts
    assert "Nyarugenge" in districts


def test_list_districts_by_province():
    r = client.get("/address/districts?province=Kigali City")
    assert r.status_code == 200
    assert set(r.json()["districts"]) == {"Gasabo", "Kicukiro", "Nyarugenge"}


def test_list_sectors():
    r = client.get("/address/sectors?province=Kigali City&district=Gasabo")
    assert r.status_code == 200
    sectors = r.json()["sectors"]
    assert len(sectors) > 5
    assert "Kimironko" in sectors
    assert "Remera" in sectors


def test_list_sectors_invalid():
    r = client.get("/address/sectors?province=Kigali City&district=NoSuchDistrict")
    assert r.status_code == 404


def test_list_cells():
    r = client.get(
        "/address/cells?province=Kigali City&district=Gasabo&sector=Kimironko"
    )
    assert r.status_code == 200
    assert len(r.json()["cells"]) > 0


def test_format_address():
    r = client.get(
        "/address/format?district=Gasabo&sector=Kimironko&cell=Bibare"
        "&village=Nyagatovu&street_road=KG 7 Ave"
    )
    assert r.status_code == 200
    fmt = r.json()["formatted"]
    assert "Gasabo" in fmt
    assert "Rwanda" in fmt
    assert "KG 7 Ave" in fmt


def test_format_address_minimal():
    r = client.get("/address/format?district=Huye")
    assert r.status_code == 200
    assert "Huye" in r.json()["formatted"]
    assert "Rwanda" in r.json()["formatted"]


# ── Legal Pages ───────────────────────────────────────────────────────────────


def test_get_terms():
    r = client.get("/legal/terms")
    assert r.status_code == 200
    data = r.json()
    assert "version" in data
    assert len(data["sections"]) >= 8
    headings = [s["heading"] for s in data["sections"]]
    assert any("Payment" in h or "Escrow" in h for h in headings)
    assert any("Dispute" in h for h in headings)


def test_get_privacy():
    r = client.get("/legal/privacy")
    assert r.status_code == 200
    data = r.json()
    assert len(data["sections"]) >= 6
    headings = [s["heading"] for s in data["sections"]]
    assert any("Collect" in h or "Information" in h for h in headings)
    assert any("Rights" in h for h in headings)


# ── Auth guards ───────────────────────────────────────────────────────────────


def test_presign_without_auth():
    assert client.post(
        "/uploads/presign", json={"upload_type": "avatar"}
    ).status_code in (401, 403)


def test_analytics_without_auth():
    assert client.get("/analytics/overview").status_code in (401, 403)


def test_earnings_without_auth():
    assert client.get("/escrow/earnings").status_code in (401, 403)


def test_withdraw_without_auth():
    assert client.post(
        "/escrow/withdraw", json={"amount": 5000, "momo_number": "0788000000"}
    ).status_code in (401, 403)


def test_schedule_me_without_auth():
    assert client.get("/schedule/me").status_code in (401, 403)


def test_dispute_evidence_without_auth():
    assert client.post(
        f"/disputes/{uuid.uuid4()}/evidence",
        json={"evidence_type": "statement", "content": "Test"},
    ).status_code in (401, 403)


def test_notification_prefs_without_auth():
    assert client.get("/notifications/preferences").status_code in (401, 403)


def test_recommended_without_auth():
    assert client.get("/recommended-artisans").status_code in (401, 403)


@pytest.mark.skip(reason="Requires live PostgreSQL — passes in production")
def test_artisan_availability_public():
    today = date.today().isoformat()
    r = client.get(f"/schedule/{uuid.uuid4()}/available?check_date={today}")
    assert r.status_code != 405


# ── Rwanda Address Utils ──────────────────────────────────────────────────────


def test_get_provinces_util():
    provinces = get_provinces()
    assert "Kigali City" in provinces
    assert len(provinces) == 5


def test_get_districts_util():
    assert len(get_districts()) > 20
    assert set(get_districts("Kigali City")) == {"Gasabo", "Kicukiro", "Nyarugenge"}


def test_get_sectors_util():
    sectors = get_sectors("Kigali City", "Gasabo")
    assert "Kimironko" in sectors
    assert get_sectors("Kigali City", "NonExistent") == []


def test_get_cells_util():
    cells = get_cells("Kigali City", "Gasabo", "Kimironko")
    assert isinstance(cells, list) and len(cells) > 0
    assert get_cells("Kigali City", "Gasabo", "NonExistent") == []


def test_format_address_util():
    result = format_address("Gasabo", "Kimironko", "Bibare", "Nyagatovu", "KG 7 Ave")
    assert all(
        x in result
        for x in ["KG 7 Ave", "Nyagatovu", "Bibare", "Kimironko", "Gasabo", "Rwanda"]
    )


def test_format_address_minimal_util():
    result = format_address("Nyarugenge", None, None, None, None)
    assert "Nyarugenge" in result and result.endswith("Rwanda")


# ── WebSocket Manager ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ws_connect_disconnect():
    manager = NotificationManager()
    mock_ws = AsyncMock()
    await manager.connect("u1", mock_ws)
    mock_ws.accept.assert_called_once()
    assert manager.active_user_count() == 1
    await manager.disconnect("u1", mock_ws)
    assert manager.active_user_count() == 0


@pytest.mark.asyncio
async def test_ws_push():
    manager = NotificationManager()
    mock_ws = AsyncMock()
    await manager.connect("u2", mock_ws)
    await manager.push("u2", {"type": "notification"})
    mock_ws.send_json.assert_called_once()


@pytest.mark.asyncio
async def test_ws_push_no_connection():
    manager = NotificationManager()
    await manager.push("nobody", {"type": "notification"})  # must not raise


@pytest.mark.asyncio
async def test_ws_dead_connection_cleanup():
    manager = NotificationManager()
    mock_ws = AsyncMock()
    mock_ws.send_json.side_effect = Exception("closed")
    await manager.connect("u3", mock_ws)
    assert manager.active_user_count() == 1
    await manager.push("u3", {"type": "test"})
    assert mock_ws not in manager._connections.get("u3", [])


# ── Escrow Service ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_escrow_hold_creation():
    mock_db = AsyncMock()
    booking_id, artisan_id, client_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    escrow = await create_escrow_hold(mock_db, booking_id, artisan_id, client_id, 25000)
    assert escrow.booking_id == booking_id
    assert escrow.amount == 25000
    assert escrow.status == EscrowStatus.held
    mock_db.add.assert_called_once()
    mock_db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_escrow_release():
    mock_escrow = MagicMock(spec=EscrowTransaction)
    mock_escrow.id = uuid.uuid4()
    mock_escrow.artisan_id = uuid.uuid4()
    mock_escrow.amount = 20000
    mock_escrow.status = EscrowStatus.held
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=mock_escrow)
    result = await release_escrow(mock_db, uuid.uuid4(), released_by="client")
    assert result is True
    mock_db.execute.assert_called()
    mock_db.add.assert_called()


@pytest.mark.asyncio
async def test_escrow_release_not_found():
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=None)
    assert await release_escrow(mock_db, uuid.uuid4()) is False


# ── Model Definitions ─────────────────────────────────────────────────────────


def test_model_tables():
    assert ArtisanSchedule.__tablename__ == "artisan_schedules"
    assert BlockedDate.__tablename__ == "artisan_blocked_dates"
    assert EscrowTransaction.__tablename__ == "escrow_transactions"
    assert WithdrawalRequest.__tablename__ == "withdrawal_requests"
    assert DisputeEvidence.__tablename__ == "dispute_evidence"


def test_enum_values():
    assert EscrowStatus.held == "held"
    assert EscrowStatus.released == "released"
    assert WithdrawalStatus.pending == "pending"
    assert WithdrawalStatus.paid == "paid"
    assert DisputeEvidenceType.photo == "photo"
    assert DisputeEvidenceType.statement == "statement"


def test_user_new_fields():
    columns = {c.name for c in User.__table__.columns}
    for field in [
        "sector",
        "cell",
        "village",
        "street_road",
        "fcm_push_token",
        "terms_accepted_at",
        "notification_prefs",
    ]:
        assert field in columns, f"Missing: {field}"


# ── OpenAPI Schema ────────────────────────────────────────────────────────────


def test_openapi_schema():
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    for path in [
        "/address/provinces",
        "/legal/terms",
        "/legal/privacy",
        "/escrow/earnings",
        "/schedule/me",
        "/uploads/presign",
        "/analytics/overview",
        "/disputes/{booking_id}/evidence",
        "/notifications/preferences",
    ]:
        assert path in paths, f"Missing from schema: {path}"
    assert len(paths) >= 50
