import { useState } from 'react';
import './App.css';
import ReactMapGl, { Marker, ViewStateChangeEvent, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Room } from '@mui/icons-material';
import * as d3 from 'd3';
const TOKEN = 'pk.eyJ1IjoiaGFzaGlyLWFmeiIsImEiOiJjbTIzOW12bGEwMndpMmxxdzN2ZWw4MDRtIn0.yaJ59WSDNCkegbnC9D9Vrw';

interface ViewPort {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface Location {
  lat: number;
  long: number;
}

interface CsvRow {
  address: string;
}

function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [viewPort, setViewPort] = useState<ViewPort>({
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 10,
  });
  const [referenceLocation, setReferenceLocation] = useState<Location | null>(null);
  const [csvData, setCsvData] = useState<string | null>(null);

  // this funtion is triggered when the csv file is uploaded, it reads the file and as text 
  //once the file is read onLoad function is triggered to update the state
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCsvData(reader.result as string);
      parseCsv(reader.result as string);
    };
    reader.readAsText(file);
  };
  // this function extracts the address field from each row to create an array of addresses
  const parseCsv = (csv: string) => {
    const rows: CsvRow[] = d3.csvParse(csv);
    const addresses = rows.map(row => row.address);
    geocodeAddresses(addresses);
  };
  //This function takes an array of adresses,  loops through each address
  // For each address, it sends a request to the Mapbox Geocoding API
  //After processing all addresses, if there are any successfully geocoded locations, the setLocations(geocodedLocations) function updates the component's state with the list of coordinates
  const geocodeAddresses = async (addresses: string[]) => {
    const geocodedLocations: Location[] = [];

    for (const address of addresses) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            address
          )}.json?access_token=${TOKEN}`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const [long, lat] = data.features[0].center;
          geocodedLocations.push({ lat, long });
        } else {
          console.error(`Geocoding failed for address: ${address}`, data);
        }
      } catch (error) {
        console.error(`Error geocoding address: ${address}`, error);
      }
    }

    if (geocodedLocations.length > 0) {
      setLocations(geocodedLocations);
    } else {
      console.error("No locations were geocoded. Please check the addresses or try again.");
    }
  };

  // This function geocodes the reference address using the Mapbox API to convert it into latitude and longitude.
  // the reference location's coordinates are stored in the component's state, and a route calculation function (fetchRoutes) is called to get the paths between the reference location and other points.
  const handleReferenceLocationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const referenceAddress = formData.get('reference') as string;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          referenceAddress
        )}.json?access_token=${TOKEN}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [long, lat] = data.features[0].center;
        setReferenceLocation({ lat, long });

        await fetchRoutes({ lat, long }, locations);
      } else {
        console.error(`Geocoding failed for reference address: ${referenceAddress}`, data);
        alert(`Could not find the location: ${referenceAddress}. Please check the address and try again.`);
      }
    } catch (error) {
      console.error(`Error geocoding reference address: ${referenceAddress}`, error);
      alert(`An error occurred while searching for the address. Please try again.`);
    }
  };

  // This function loops through all destination locations and makes requests to the Mapbox Directions API to calculate the driving routes from the reference location to each destination.
  // After gathering all routes, the function updates the component's state with the collected routes, which can be rendered on the map
  const fetchRoutes = async (referenceLoc: Location, destinationLocations: Location[]) => {
    const routesData: any[] = [];

    for (const destination of destinationLocations) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${referenceLoc.long},${referenceLoc.lat};${destination.long},${destination.lat}?geometries=geojson&access_token=${TOKEN}`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          routesData.push(data.routes[0].geometry);
        } else {
          console.error('No route found', data);
        }
      } catch (error) {
        console.error('Error fetching route', error);
      }
    }

    setRoutes(routesData);
  };

  return (
    <div className='map-div'>
      <div className='d-flex justify-content-center align-items-center py-3'>
        <input type="file" accept=".csv" onChange={handleCsvUpload} />
        <form onSubmit={handleReferenceLocationSubmit}>
          <input type="text" name="reference" placeholder="Enter frame of reference location" className='rounded w-70'/>
          <button type="submit" className='btn btn-md btn-primary ms-2'>Submit</button>
        </form>
      </div>

      <ReactMapGl
        {...viewPort}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onMove={(evt: ViewStateChangeEvent) =>
          setViewPort({
            latitude: evt.viewState.latitude,
            longitude: evt.viewState.longitude,
            zoom: evt.viewState.zoom,
          })
        }
        style={{ width: '100%', height: '100%' }}
      >
        {/* Render location markers */}
        {locations.map((location, index) => (
          <Marker
            key={`${location.lat}${location.long}`}
            latitude={location.lat}
            longitude={location.long}
          >
            <Room className='map-marker' />
          </Marker>
        ))}

        {/* Render reference location marker */}
        {referenceLocation && (
          <Marker
            key={`${referenceLocation.lat}${referenceLocation.long}`}
            latitude={referenceLocation.lat}
            longitude={referenceLocation.long}
          >
            <Room className='selected-map-marker' />
          </Marker>
        )}

        {/* Render the actual routes from Directions API */}
        {routes.map((route, index) => (
          <Source
            key={`route-${index}`}
            id={`route-${index}`}
            type="geojson"
            data={{
              type: 'Feature',
              geometry: route,
            }}
          >
            <Layer
              id={`route-line-${index}`}
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
              paint={{
                'line-color': '#888',
                'line-width': 6,
              }}
            />
          </Source>
        ))}
      </ReactMapGl>
    </div>
  );
}

export default App;
