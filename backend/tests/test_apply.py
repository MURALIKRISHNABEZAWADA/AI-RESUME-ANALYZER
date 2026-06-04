import pytest

from app.config import Settings
from app.schemas import ApplicantProfile
from app.services.apply import PortalApplicant


@pytest.mark.asyncio
async def test_apply_dry_run_detects_supported_portal_without_browser():
    profile = ApplicantProfile(first_name="Ada", last_name="Lovelace", email="ada@example.com", phone="555-0100")
    result = await PortalApplicant(Settings()).apply(
        "https://boards.greenhouse.io/acme/jobs/123",
        profile,
        dry_run=True,
    )

    assert result.status == "ready_for_review"
    assert result.portal == "greenhouse"


@pytest.mark.asyncio
async def test_apply_rejects_unsupported_portal():
    profile = ApplicantProfile(first_name="Ada", last_name="Lovelace", email="ada@example.com", phone="555-0100")
    result = await PortalApplicant(Settings()).apply("https://example.com/job/123", profile, dry_run=True)

    assert result.status == "unsupported_portal"
    assert result.portal == "other"
