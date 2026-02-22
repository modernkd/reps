import { expect, test, type Page, type TestInfo } from '@playwright/test'

type ViewportCase = {
  name: string
  width: number
  height: number
}

const VIEWPORTS: ViewportCase[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

async function captureStep(
  page: Page,
  testInfo: TestInfo,
  viewportName: string,
  step: number,
  label: string,
): Promise<void> {
  const path = testInfo.outputPath(`${viewportName}-${String(step).padStart(2, '0')}-${label}.png`)
  await page.screenshot({ path })
  await testInfo.attach(`${viewportName}-${String(step).padStart(2, '0')}-${label}`, {
    path,
    contentType: 'image/png',
  })
}

for (const viewport of VIEWPORTS) {
  test.describe(`responsive interactions (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test(`captures key UI states in ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000)

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: 'Consistency dashboard' })).toBeVisible()
      await captureStep(page, testInfo, viewport.name, 1, 'home-calendar')

      const templateTrigger = page.getByLabel('Select template')
      await expect(templateTrigger).toBeVisible()
      await templateTrigger.selectOption({ index: 0 })
      await captureStep(page, testInfo, viewport.name, 2, 'template-picker')

      const manageTemplateButton = page.locator('summary[aria-label^="Manage "]').first()
      await expect(manageTemplateButton).toBeVisible()
      await manageTemplateButton.click()
      await expect(page.getByRole('button', { name: 'Edit template' })).toBeVisible()
      await captureStep(page, testInfo, viewport.name, 3, 'template-actions-open')

      await page.getByRole('button', { name: 'Edit template' }).click()
      await expect(page.getByRole('dialog', { name: 'Edit template' })).toBeVisible()
      await captureStep(page, testInfo, viewport.name, 4, 'edit-template-modal')

      await page.getByRole('button', { name: 'Add day' }).click()
      await page.getByRole('button', { name: 'Add exercise' }).first().click()
      await captureStep(page, testInfo, viewport.name, 5, 'edit-template-expanded')

      await page.getByRole('button', { name: 'Close' }).click()
      await expect(page.getByRole('dialog', { name: 'Edit template' })).toBeHidden()

      await page.getByRole('button', { name: 'Add template to calendar' }).click()
      await expect(page.getByRole('dialog', { name: 'Apply template to calendar' })).toBeVisible()
      await captureStep(page, testInfo, viewport.name, 6, 'apply-template-modal')

      await page.getByRole('button', { name: 'Close' }).click()
      await expect(page.getByRole('dialog', { name: 'Apply template to calendar' })).toBeHidden()

      await page.getByRole('tab', { name: 'Graphs' }).click()
      await expect(page.getByRole('heading', { name: 'Weekly Workout Trends' })).toBeVisible()
      await captureStep(page, testInfo, viewport.name, 7, 'graph-view')

      await page.getByRole('tab', { name: 'Calendar' }).click()
      const dayCell = page.getByRole('gridcell').first()
      await expect(dayCell).toBeVisible()
      await dayCell.click()
      await expect(page.getByRole('region', { name: 'Workout details for selected date' })).toBeVisible()
      await captureStep(page, testInfo, viewport.name, 8, 'calendar-details')
    })
  })
}
