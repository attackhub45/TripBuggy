import { expect, type Page } from '@playwright/test';

/** Starts a trip from Home and answers the four intake questions, landing on Summary. */
export async function startTrip(
  page: Page,
  destination: string,
  answers: { when?: string; who?: string; budget?: string; pace?: string } = {},
) {
  await page.goto('/');
  await page.getByPlaceholder('Where do you want to go?').fill(destination);
  await page.getByRole('button', { name: 'Plan my trip' }).click();

  await page.getByRole('button', { name: answers.when ?? 'This month' }).click();
  await page.getByRole('button', { name: answers.who ?? 'Just me' }).click();
  await page.getByRole('button', { name: answers.budget ?? 'Treat yourself' }).click();
  await page.getByRole('button', { name: answers.pace ?? 'Relaxed' }).click();

  await expect(page.getByText(`Planning your trip to`)).toBeVisible();
}

/** From Summary: sets trip length and continues to the agent-drafted Route screen. */
export async function setTripLengthAndContinue(page: Page, days: number) {
  await page.getByPlaceholder('e.g. 5').fill(String(days));
  await page.getByRole('button', { name: 'See my route' }).click();
  await expect(page).toHaveURL(/\/route$/);
}

/** Waits for the agent's route draft (real Claude or the simulated fallback) to land —
 * the "Discover options" button only enables once routeLoading clears, so it's a more
 * reliable signal than the stop cards, whose skeleton placeholders share the same class. */
export async function waitForRouteDraft(page: Page) {
  await expect(page.getByRole('button', { name: 'Discover options' })).toBeEnabled({ timeout: 30_000 });
}

/** From Route: continues to Discover and waits for the agent's suggested options. Real
 * discovery now does live web search per item (see agent_service.py), which can take
 * well over a minute against a real API key — CI's simulated fallback (no key) is much
 * faster, but the timeout has to cover the slower real-agent case too. */
export async function goToDiscoverAndWait(page: Page) {
  await page.getByRole('button', { name: 'Discover options' }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByTestId('add-suggestion').first()).toBeVisible({ timeout: 150_000 });
}
