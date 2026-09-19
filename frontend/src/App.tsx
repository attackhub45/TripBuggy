import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DestinationArtDefs } from './art/DestinationArt';
import { AccountBar } from './components/AccountBar';
import { getActiveTripId } from './api/client';
import { useTripStore } from './state/tripStore';
import { useAuthStore } from './state/authStore';
import { HomeScreen } from './screens/HomeScreen';
import { FlowScreen } from './screens/FlowScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { RouteScreen } from './screens/RouteScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { ItineraryScreen } from './screens/ItineraryScreen';
import { BookingScreen } from './screens/BookingScreen';
import { OnTheRoadScreen } from './screens/OnTheRoadScreen';
import { RecapScreen } from './screens/RecapScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { TripsListScreen } from './screens/TripsListScreen';

/** Every screen past Home needs a destination to already be set — bounce back if it isn't. */
function RequireTrip({ children }: { children: React.ReactNode }) {
  const destinationRaw = useTripStore((s) => s.destinationRaw);
  if (!destinationRaw) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const loadTrip = useTripStore((s) => s.loadTrip);

  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    (async () => {
      await checkAuth();
      const activeTripId = getActiveTripId();
      if (activeTripId) {
        // Refresh resilience: rehydrate whatever trip was last open before this
        // page load, so a browser refresh mid-flow doesn't lose your place.
        try {
          await loadTrip(activeTripId);
        } catch {
          // stale/inaccessible trip id — fall through to a normal, empty start
        }
      }
      setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!booted) return null;

  return (
    <BrowserRouter>
      <DestinationArtDefs />
      <div className="app-shell">
        <div className="screen-wrap">
          <AccountBar />
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/trips" element={<TripsListScreen />} />
            <Route path="/flow" element={<RequireTrip><FlowScreen /></RequireTrip>} />
            <Route path="/summary" element={<RequireTrip><SummaryScreen /></RequireTrip>} />
            <Route path="/route" element={<RequireTrip><RouteScreen /></RequireTrip>} />
            <Route path="/discover" element={<RequireTrip><DiscoverScreen /></RequireTrip>} />
            <Route path="/itinerary" element={<RequireTrip><ItineraryScreen /></RequireTrip>} />
            <Route path="/booking" element={<RequireTrip><BookingScreen /></RequireTrip>} />
            <Route path="/road" element={<RequireTrip><OnTheRoadScreen /></RequireTrip>} />
            <Route path="/recap" element={<RequireTrip><RecapScreen /></RequireTrip>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
