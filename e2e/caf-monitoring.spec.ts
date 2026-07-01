import { expect, test } from "@playwright/test"

test.describe("CAF Monitoring Dashboard", () => {
  test("loads dashboard with consistent KPI and card data", async ({ page, request }) => {
    const [payload] = await Promise.all([
      request.get("/api/caf/site-data").then((res) => res.json()),
      page.goto("/caf-monitoring"),
    ])

    expect(payload.status).toBe("success")
    expect(payload.data.length).toBeGreaterThan(0)

    await expect(page.getByRole("heading", { name: /CAF Monitoring Dashboard/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /^Export$/i })).toBeVisible()
    await expect(page.getByText("CAF Pipeline")).toBeVisible()
    await expect(page.getByText(/AF Complete/i)).toBeVisible()
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

    await expect(page.locator(".caf-pipeline-card")).toBeVisible()

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
    await expect(page.locator(".caf-pipeline-card")).toBeVisible()
    await expect(page.locator(".caf-af-complete-card")).toBeVisible()

    const runrateCard = page.locator(".caf-wallboard-runrate--compact")
    const runrateBox = await runrateCard.boundingBox()
    expect(runrateBox).not.toBeNull()
    expect(runrateBox!.height).toBeLessThan(180)

    await page.screenshot({
      path: "screenshots/caf-monitoring-layout.png",
      fullPage: false,
    })
  })

  test("tablet uses scalable wallboard above mobile breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await page.goto("/caf-monitoring")
    await page.waitForResponse((res) => res.url().includes("/api/caf/site-data"))

    await expect(page.locator(".caf-wallboard-grid")).toBeVisible()
    await expect(page.locator(".caf-mobile-layout")).toHaveCount(0)
  })

  test("desktop uses wallboard at full scale", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto("/caf-monitoring")
    await page.waitForResponse((res) => res.url().includes("/api/caf/site-data"))

    await expect(page.locator(".caf-wallboard-grid")).toBeVisible()
    await expect(page.locator(".viewport-wrapper--fitted")).toHaveCount(0)

    const scale = await page.locator("#wb-canvas").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--wb-scale").trim()
    )
    expect(scale === "" || scale === "1").toBeTruthy()
  })

  test("mobile layout shows scrollable cards without wallboard scale", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/caf-monitoring")
    await page.waitForResponse((res) => res.url().includes("/api/caf/site-data"))

    await expect(page.locator(".caf-mobile-layout")).toBeVisible()
    await expect(page.locator(".caf-wallboard-grid")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: /CAF Monitoring Dashboard/i })).toBeVisible()
    await expect(page.getByText("Filter Data")).toBeVisible()
    await expect(page.getByText("CAF Pipeline")).toBeVisible()
    await expect(page.getByText(/AF Complete/i)).toBeVisible()
    await expect(page.getByText("Daily CAF Runrate")).toBeVisible()
    await expect(page.locator(".caf-status-assignee-grid--mobile")).toHaveCount(0)
  })
})
