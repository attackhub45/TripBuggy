import { expect, test } from '@playwright/test';
import { goToDiscoverAndWait, setTripLengthAndContinue, startTrip, waitForRouteDraft } from './helpers';

test('walks one full trip from Home through Recap, including the on-the-road change loop', async ({ page }) => {
  await startTrip(page, 'Paris');
  await setTripLengthAndContinue(page, 4);

  // Plan the Route — agent-drafted (real Claude or simulated fallback, see helpers.ts).
  await waitForRouteDraft(page);
  const stopCountBefore = await page.locator('.card').count();
  expect(stopCountBefore).toBeGreaterThanOrEqual(3);

  // Discover & Add — add two suggestions, keeping the total low and comfortably under
  // the "Treat yourself" budget cap regardless of what the agent priced them at.
  await goToDiscoverAndWait(page);
  // Scoped to buttons still reading "Add" (not "Added") so .first() always targets an
  // unclicked suggestion, never a disabled one waiting to become actionable.
  const addButtons = page.getByTestId('add-suggestion').and(page.getByRole('button', { name: 'Add', exact: true }));
  await addButtons.first().click();
  await expect(page.getByRole('button', { name: 'Added' })).toHaveCount(1);
  await addButtons.first().click();
  await expect(page.getByRole('button', { name: 'Added' })).toHaveCount(2);

  // Build Itinerary — two items land on different day/slot rotations, so no conflict.
  await page.getByRole('button', { name: 'Build itinerary' }).click();
  await expect(page).toHaveURL(/\/itinerary$/);
  await expect(page.getByText('over budget')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to booking' }).click();
  await expect(page).toHaveURL(/\/booking$/);

  // Agentic Booking — full auto books everything in one call, no per-item approval needed.
  await page.getByRole('button', { name: 'Full auto' }).click();
  await page.getByRole('button', { name: 'Book everything' }).click();
  await expect(page.getByText('Booked', { exact: true })).toHaveCount(2, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Hit the road' }).click();
  await expect(page).toHaveURL(/\/road$/);

  // On the Road — submit a free-text change; the agent (or its fallback) picks one of
  // the two booked items and sends this back into Booking for approval.
  await page.getByPlaceholder(/my flight got delayed/).fill('actually cancel one of these, plans changed');
  await page.getByRole('button', { name: 'Tell the agent' }).click();
  await expect(page).toHaveURL(/\/booking$/);
  await expect(page.getByText('Resolving an on-the-road change')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Booked', { exact: true })).toHaveCount(2);

  // Back on the road, then wrap the trip up.
  await page.getByRole('button', { name: 'Hit the road' }).click();
  await expect(page).toHaveURL(/\/road$/);
  await page.getByRole('button', { name: 'End trip' }).click();
  await expect(page).toHaveURL(/\/recap$/);
  await expect(page.getByText("That's a wrap on")).toBeVisible();
});
