import { expect, test } from '@playwright/test';
import { setTripLengthAndContinue, startTrip, waitForRouteDraft } from './helpers';

/**
 * Uses manual-entry items with fixed costs (instead of agent-suggested ones, whose price
 * varies) so the over/under-budget outcome is deterministic regardless of whether the
 * agent layer is live or on its simulated fallback.
 */
test('the over-budget loop sends you back to Discover, and clears once you drop the item', async ({ page }) => {
  await startTrip(page, 'Lisbon', { budget: 'Budget-friendly' }); // $1200 cap
  await setTripLengthAndContinue(page, 3);
  await waitForRouteDraft(page);
  await page.getByRole('button', { name: 'Discover options' }).click();
  await expect(page).toHaveURL(/\/discover$/);

  const manualForm = page.locator('form').filter({ has: page.getByPlaceholder('What is it?') });
  await manualForm.getByPlaceholder('What is it?').fill('Overpriced splurge');
  await manualForm.getByPlaceholder('$').fill('2000');
  await manualForm.getByRole('button', { name: 'Add' }).click();

  await manualForm.getByPlaceholder('What is it?').fill('Cheap walk');
  await manualForm.getByPlaceholder('$').fill('20');
  await manualForm.getByRole('button', { name: 'Add' }).click();

  await page.getByRole('button', { name: 'Build itinerary' }).click();
  await expect(page).toHaveURL(/\/itinerary$/);
  await expect(page.getByText('over budget', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to booking' })).toBeDisabled();

  await page.getByRole('button', { name: 'Back to Discover & Add' }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByText('Over budget — swap or remove an item')).toBeVisible();

  await page.getByRole('button', { name: 'Build itinerary' }).click();
  await expect(page).toHaveURL(/\/itinerary$/);
  await page.locator('.card', { hasText: 'Overpriced splurge' }).getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('over budget')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to booking' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue to booking' }).click();
  await expect(page).toHaveURL(/\/booking$/);
});
