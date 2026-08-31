import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DestinationArtDefs } from './art/DestinationArt';
import { useTripStore } from './state/tripStore';
import { HomeScreen } from './screens/HomeScreen';
import { FlowScreen } from './screens/FlowScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { RouteScreen } from './screens/RouteScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { ItineraryScreen } from './screens/ItineraryScreen';
import { BookingScreen } from './screens/BookingScreen';
import { OnTheRoadScreen } from './screens/OnTheRoadScreen';
import { RecapScreen } from './screens/RecapScreen';

/** Every screen past Home needs a destination to already be set — bounce back if it isn't. */
function RequireTrip({ children }: { children: React.ReactNode }) {
  const destinationRaw = useTripStore((s) => s.destinationRaw);
  if (!destinationRaw) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <DestinationArtDefs />
      <div className="app-shell">
        <div className="screen-wrap">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
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
