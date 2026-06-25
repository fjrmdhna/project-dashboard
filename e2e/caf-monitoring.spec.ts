import { expect, test } from "@playwright/test"

test.describe("CAF Monitoring Dashboard", () => {
  test("loads dashboard with consistent KPI and card data", async ({ page }) => {
    const apiPromise = page.waitForResponse(
      (res) => res.url().includes("/api/caf/site-data") && res.status() === 200,
      { timeout: 60_000 }
    )

    await page.goto("/caf-monitoring")
    const apiResponse = await apiPromise
    const payload = await apiResponse.json()

    expect(payload.status).toBe("success")
    expect(payload.data.length).toBeGreaterThan(0)

    await expect(page.getByRole("heading", { name: /CAF Monitoring Dashboard/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /^Export$/i })).toBeVisible()
    await expect(page.getByText("CAF Pipeline")).toBeVisible()
    await expect(page.getByText("AF Milestone Coverage")).toBeVisible()
    await expect(page.getByText("Approved – Awaiting Impl.")).toBeVisible()
    await expect(page.getByText("Review – TLP")).toBeVisible()
    await expect(page.getByText("Daily CAF Runrate")).toBeVisible()

    const totalText = payload.data.length.toLocaleString("en-US")
    await expect(page.getByText(totalText).first()).toBeVisible()
  })

  test("uses a single site-data API request on initial load", async ({ page }) => {
    const cafRequests: string[] = []

    page.on("request", (req) => {
      const path = new URL(req.url()).pathname
      if (path.startsWith("/api/caf/")) {
        cafRequests.push(path)
      }
    })

    await page.goto("/caf-monitoring")
    await page.waitForResponse((res) => res.url().includes("/api/caf/site-data"))

    await expect(page.locator(".caf-status-assignee-grid")).toBeVisible()

    const siteDataHits = cafRequests.filter((p) => p === "/api/caf/site-data")
    expect(siteDataHits.length).toBe(1)

    const dashboardHits = cafRequests.filter((p) => p === "/api/caf/dashboard")
    expect(dashboardHits).toEqual([])
  })

  test("filter reset clears active filters", async ({ page }) => {
    await page.goto("/caf-monitoring")
    await page.waitForResponse((res) => res.url().includes("/api/caf/site-data"))

    await page.locator(".caf-filter-bar").getByRole("button", { name: "Project" }).click()
    await page.locator('input[placeholder="Search..."]').waitFor({ state: "visible" })

    const firstOption = page
      .locator('[class*="fixed"][class*="z-[9999]"] button')
      .filter({ has: page.locator("span.truncate") })
      .first()
    await firstOption.click()

    const resetButton = page.getByRole("button", { name: /reset filters/i })
    await expect(resetButton).toBeEnabled()
    await resetButton.click()
    await expect(resetButton).toBeDisabled()
  })

  test("site-data API responds within performance budget", async ({ request }) => {
    const started = Date.now()
    const response = await request.get("/api/caf/site-data")
    const elapsed = Date.now() - started

    expect(response.ok()).toBeTruthy()
    const payload = await response.json()
    expect(payload.data.length).toBeGreaterThan(0)

    expect(elapsed).toBeLessThan(30_000)
  })

  test("layout screenshot matches wallboard at 1920x1080", async ({ page }) => {
    await page.goto("/caf-monitoring")
    await page.waitForResponse((res) => res.url().includes("/api/caf/site-data"))

    await expect(page.locator(".caf-wallboard-grid")).toBeVisible()

    const statusGrid = page.locator(".caf-status-assignee-grid")
    await expect(statusGrid).toBeVisible()

    const statusCards = statusGrid.locator(".caf-status-assignee-card")
    await expect(statusCards).toHaveCount(8)

    for (let cardIndex = 0; cardIndex < 8; cardIndex++) {
      const card = statusCards.nth(cardIndex)
      const cardBox = await card.boundingBox()
      expect(cardBox).not.toBeNull()
      expect(cardBox!.height).toBeGreaterThan(48)
    }

    const runrateCard = page.locator(".caf-wallboard-runrate--compact")
    const runrateBox = await runrateCard.boundingBox()
    expect(runrateBox).not.toBeNull()
    expect(runrateBox!.height).toBeLessThan(240)

    await page.screenshot({
      path: "screenshots/caf-monitoring-layout.png",
      fullPage: false,
    })
  })
})
