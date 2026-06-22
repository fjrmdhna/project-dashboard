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
    await expect(page.getByText("CAF Pipeline")).toBeVisible()
    await expect(page.getByText("CAF Status Funnel")).toBeVisible()
    await expect(page.getByText("CAF Aging")).toBeVisible()
    await expect(page.getByText("Daily CAF Runrate")).toBeVisible()
    await expect(page.getByText("Top 5 RAN Vendor")).toBeVisible()
    await expect(page.getByText("Top 5 TLP Vendor")).toBeVisible()

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

    await expect(page.getByText("CAF Status Funnel")).toBeVisible()

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

    await expect(page.getByText("Top 5 RAN Vendor")).toBeVisible()
    await expect(page.getByText("Top 5 TLP Vendor")).toBeVisible()
    await expect(page.locator(".caf-wallboard-grid")).toBeVisible()

    const agingCard = page.locator(".caf-aging-card")
    const agingBox = await agingCard.boundingBox()
    expect(agingBox).not.toBeNull()

    const agingFooter = agingCard.locator(".caf-aging-footer")
    const footerBox = await agingFooter.boundingBox()
    expect(footerBox).not.toBeNull()
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(agingBox!.y + agingBox!.height + 1)

    const funnelCard = page.locator(".caf-wallboard-funnel")
    const funnelBox = await funnelCard.boundingBox()
    expect(funnelBox).not.toBeNull()

    const funnelRows = funnelCard.locator(".caf-funnel-row")
    await expect(funnelRows).toHaveCount(8)

    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
      const rowBox = await funnelRows.nth(rowIndex).boundingBox()
      expect(rowBox).not.toBeNull()
      expect(rowBox!.y).toBeGreaterThanOrEqual(funnelBox!.y - 1)
      expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(funnelBox!.y + funnelBox!.height + 1)
      expect(rowBox!.height).toBeGreaterThan(6)
    }

    const vendorCards = page.locator(".caf-wallboard-vendor-ran, .caf-wallboard-vendor-tlp")
    await expect(vendorCards).toHaveCount(2)

    for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
      const card = vendorCards.nth(cardIndex)
      const cardBox = await card.boundingBox()
      expect(cardBox).not.toBeNull()

      const rows = card.locator(".caf-vendor-row")
      await expect(rows).toHaveCount(5)

      for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
        const rowBox = await rows.nth(rowIndex).boundingBox()
        expect(rowBox).not.toBeNull()
        expect(rowBox!.y).toBeGreaterThanOrEqual(cardBox!.y - 1)
        expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1)
        expect(rowBox!.height).toBeGreaterThan(6)
      }
    }

    await page.screenshot({
      path: "screenshots/caf-monitoring-layout.png",
      fullPage: false,
    })
  })
})
