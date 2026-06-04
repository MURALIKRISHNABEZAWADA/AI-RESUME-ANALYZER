from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from playwright.async_api import Page, async_playwright

from ..config import Settings
from ..schemas import ApplicantProfile
from .scraper import detect_portal


@dataclass(frozen=True)
class ApplyResult:
    status: str
    portal: str
    notes: str


class PortalApplicant:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def apply(self, url: str, profile: ApplicantProfile, dry_run: bool = True) -> ApplyResult:
        portal = detect_portal(url)
        if portal not in {"greenhouse", "lever", "workday"}:
            return ApplyResult("unsupported_portal", portal, "Only Greenhouse, Lever, and Workday are automated.")

        if dry_run:
            return ApplyResult("ready_for_review", portal, f"Dry run validated a {portal} application target.")

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=self.settings.playwright_headless)
            page = await browser.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                if portal == "greenhouse":
                    await self._fill_greenhouse(page, profile)
                elif portal == "lever":
                    await self._fill_lever(page, profile)
                else:
                    await self._fill_workday(page, profile)

                if self.settings.auto_submit_applications:
                    await self._submit(page)
                    return ApplyResult("submitted", portal, "Application submitted through Playwright.")
                return ApplyResult("filled_pending_submit", portal, "Form filled. Enable AUTO_SUBMIT_APPLICATIONS to submit.")
            finally:
                await browser.close()

    async def _fill_greenhouse(self, page: Page, profile: ApplicantProfile) -> None:
        await self._fill_common(page, profile)
        await self._fill_by_label(page, "First Name", profile.first_name)
        await self._fill_by_label(page, "Last Name", profile.last_name)
        await self._upload_resume(page, profile.resume_file_path)

    async def _fill_lever(self, page: Page, profile: ApplicantProfile) -> None:
        await self._fill_common(page, profile)
        await self._fill_by_label(page, "Full name", f"{profile.first_name} {profile.last_name}")
        await self._upload_resume(page, profile.resume_file_path)

    async def _fill_workday(self, page: Page, profile: ApplicantProfile) -> None:
        await self._fill_common(page, profile)
        await self._fill_by_label(page, "First Name", profile.first_name)
        await self._fill_by_label(page, "Last Name", profile.last_name)
        await self._upload_resume(page, profile.resume_file_path)

    async def _fill_common(self, page: Page, profile: ApplicantProfile) -> None:
        values = {
            "Email": profile.email,
            "Phone": profile.phone,
            "LinkedIn": profile.linkedin_url or "",
            "Website": profile.portfolio_url or "",
            "Portfolio": profile.portfolio_url or "",
            "Location": profile.location or "",
            "Cover Letter": profile.cover_letter or "",
            "Authorization": profile.work_authorization or "Yes",
        }
        for label, value in values.items():
            if value:
                await self._fill_by_label(page, label, value)

    @staticmethod
    async def _fill_by_label(page: Page, label: str, value: str) -> None:
        locators = [
            page.get_by_label(label, exact=False),
            page.locator(f"input[placeholder*='{label}' i]"),
            page.locator(f"textarea[placeholder*='{label}' i]"),
            page.locator(f"input[name*='{label.replace(' ', '_')}' i]"),
            page.locator(f"textarea[name*='{label.replace(' ', '_')}' i]"),
        ]
        for locator in locators:
            try:
                if await locator.count():
                    await locator.first.fill(value, timeout=1500)
                    return
            except Exception:
                continue

    @staticmethod
    async def _upload_resume(page: Page, resume_file_path: str | None) -> None:
        if not resume_file_path:
            return
        resume_path = Path(resume_file_path)
        if not resume_path.exists():
            raise FileNotFoundError(f"Resume file not found: {resume_file_path}")
        upload = page.locator("input[type='file']").first
        if await upload.count():
            await upload.set_input_files(str(resume_path))

    @staticmethod
    async def _submit(page: Page) -> None:
        for text in ("Submit Application", "Submit application", "Apply", "Submit"):
            button = page.get_by_role("button", name=text, exact=False)
            if await button.count():
                await button.first.click()
                return
        raise RuntimeError("Submit button was not found.")
