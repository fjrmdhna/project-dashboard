import { test, expect } from '@playwright/test'

test('Sanitation Report is covered by a blocking blurred maintenance notice', async ({ page }) => {
  await page.goto('/sanitation-report?vendor=NOKIA')
  const notice = page.getByRole('alertdialog', { name: 'Under Maintenance' })
  await expect(notice).toBeVisible()
  await expect(notice).toHaveCSS('backdrop-filter', /blur\(/)
  await expect(page.locator('[inert]')).toHaveCount(1)
  await expect(notice).toContainText('Silakan kembali lagi nanti')
})
