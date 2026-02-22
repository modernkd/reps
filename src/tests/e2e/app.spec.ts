import { expect, test } from '@playwright/test'

test('loads dashboard shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Consistency dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add workout' }).first()).toBeVisible()
})
